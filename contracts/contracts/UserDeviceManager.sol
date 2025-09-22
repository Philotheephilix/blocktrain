// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IUserDeviceManager} from "./interfaces/IUserDeviceManager.sol";
import {ByteHasher} from "./helpers/ByteHasher.sol";
import {IUniqueId} from "./interfaces/IUniqueId.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {StringUtils} from "@ensdomains/ens-contracts/contracts/utils/StringUtils.sol";
import {IL2Registry} from "./interfaces/IL2Registry.sol";

/// @dev User-specific contract for managing devices and app permissions
contract UserDeviceManager is IUserDeviceManager {
    using StringUtils for string;
    using ByteHasher for bytes;

    /// @dev The unique ID instance for proof verification
    IUniqueId internal immutable uniqueId;
    
    /// @dev The L2Registry contract
    IL2Registry private immutable registryContract;
    
    /// @dev The user's ENS domain name
    string public ensDomain;
    
    /// @dev The user's address
    address public immutable userAddress;
    
    /// @dev The user's nullifier hash for authentication
    uint256 public immutable userNullifierHash;
    
    /// @dev The coinType for the current chain (ENSIP-11)
    uint256 public immutable coinType;
    
    /// @dev The chainId for the current chain
    uint256 public chainId;
    
    /// @dev The unique ID group ID (always 1)
    uint256 internal immutable groupId = 1;
    
    /// @dev Mapping from device hash to device info
    mapping(bytes32 => Device) public devices;
    
    /// @dev Mapping from device hash to app ID to permission
    mapping(bytes32 => mapping(string => AppPermission)) public deviceApps;
    
    /// @dev Mapping from device hash to array of app IDs for enumeration
    mapping(bytes32 => string[]) public deviceAppIds;
    
    /// @dev Array of all device hashes for enumeration
    bytes32[] public deviceHashes;
    
    /// @dev Whether a nullifier hash has been used already
    mapping(uint256 => bool) internal nullifierHashes;
    
    error DuplicateNullifier(uint256 nullifierHash);
    error DeviceNotFound(bytes32 deviceHash);
    error AppNotFound(bytes32 deviceHash, string appId);
    error InvalidPermission(uint8 permission);
    error Unauthorized();
    error DeviceAlreadyExists(bytes32 deviceHash);
    
    /// @notice Initializes the user device manager
    /// @param _uniqueId The uniqueID router for proof verification
    /// @param _registry Address of the L2Registry contract
    /// @param _userAddress The user's address
    /// @param _ensDomain The user's ENS domain name
    /// @param _userNullifierHash The user's nullifier hash
    constructor(
        IUniqueId _uniqueId,
        address _registry,
        address _userAddress,
        string memory _ensDomain,
        uint256 _userNullifierHash
    ) {
        assembly {
            sstore(chainId.slot, chainid())
        }
        coinType = (0x80000000 | chainId) >> 0;
        registryContract = IL2Registry(_registry);
        uniqueId = _uniqueId;
        userAddress = _userAddress;
        ensDomain = _ensDomain;
        userNullifierHash = _userNullifierHash;
        
        // Register the main ENS domain for the user
        _registerMainDomain();
    }
    
    /// @notice Register the main ENS domain for the user
    function _registerMainDomain() internal {
        bytes32 node = _labelToNode(ensDomain);
        bytes memory addr = abi.encodePacked(userAddress);
        
        registryContract.setAddr(node, coinType, addr);
        registryContract.setAddr(node, 60, addr);
        registryContract.setText(node, "description", "User device manager contract");
        
        registryContract.createSubnode(
            registryContract.baseNode(),
            ensDomain,
            userAddress,
            new bytes[](0)
        );
    }
    
    /// @notice Add a new device with model and create subdomain
    /// @param model The device model name
    /// @param deviceAddress The device's address
    /// @param deviceNullifier The device's nullifier hash
    /// @param root The root of the Merkle tree
    /// @param nullifierHash The nullifier hash for this proof
    /// @param proof The zero-knowledge proof
    function addDevice(
        string calldata model,
        address deviceAddress,
        uint256 deviceNullifier,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external {
        // Verify the proof using the user's nullifier
        _verifyProof(userAddress, root, nullifierHash, proof);
        
        // Create subdomain: model.ens.eth
        string memory subdomain = string(abi.encodePacked(model, ".", ensDomain));
        
        // Create device hash using keccak256(subdomain + deviceAddress + deviceNullifier)
        bytes32 deviceHash = keccak256(abi.encodePacked(subdomain, deviceAddress, deviceNullifier));
        
        // Check if device already exists
        if (devices[deviceHash].exists) {
            revert DeviceAlreadyExists(deviceHash);
        }
        
        // Create the device
        devices[deviceHash] = Device({
            model: model,
            subdomain: subdomain,
            deviceAddress: deviceAddress,
            deviceNullifier: deviceNullifier,
            exists: true
        });
        
        // Add to device hashes array
        deviceHashes.push(deviceHash);
        
        // Initialize empty app list for this device
        deviceAppIds[deviceHash] = new string[](0);
        
        // Register the subdomain
        _registerSubdomain(model, deviceAddress);
        
        emit DeviceAdded(deviceHash, model, subdomain, deviceAddress, deviceNullifier);
    }
    
    /// @notice Register a subdomain for the device
    function _registerSubdomain(string calldata model, address deviceAddress) internal {
        string memory subdomain = string(abi.encodePacked(model, ".", ensDomain));
        bytes32 node = _labelToNode(subdomain);
        bytes memory addr = abi.encodePacked(deviceAddress);
        
        registryContract.setAddr(node, coinType, addr);
        registryContract.setAddr(node, 60, addr);
        registryContract.setText(node, "device_model", model);
        registryContract.setText(node, "description", "Device subdomain");
        
        registryContract.createSubnode(
            _labelToNode(ensDomain),
            model,
            deviceAddress,
            new bytes[](0)
        );
    }
    
    /// @notice Add an app to a device with permission
    /// @param deviceHash The hash of the device
    /// @param appId The app identifier
    /// @param permission The permission level (0/1/2/3)
    function addAppToDevice(
        bytes32 deviceHash,
        string calldata appId,
        uint8 permission
    ) external {
        // Only the user can add apps
        if (msg.sender != userAddress) {
            revert Unauthorized();
        }
        
        // Validate permission
        if (permission > 3) {
            revert InvalidPermission(permission);
        }
        
        // Check if device exists
        if (!devices[deviceHash].exists) {
            revert DeviceNotFound(deviceHash);
        }
        
        // Add or update app permission
        deviceApps[deviceHash][appId] = AppPermission({
            permission: permission,
            exists: true
        });
        
        // Add app ID to device's app list if not already present
        if (!deviceApps[deviceHash][appId].exists) {
            deviceAppIds[deviceHash].push(appId);
        }
        
        emit AppAdded(deviceHash, appId, permission);
    }
    
    /// @notice Update app permission for a device
    /// @param deviceHash The hash of the device
    /// @param appId The app identifier
    /// @param newPermission The new permission level (0/1/2/3)
    function updateAppPermission(
        bytes32 deviceHash,
        string calldata appId,
        uint8 newPermission
    ) external {
        // Only the user can update permissions
        if (msg.sender != userAddress) {
            revert Unauthorized();
        }
        
        // Validate permission
        if (newPermission > 3) {
            revert InvalidPermission(newPermission);
        }
        
        // Check if device exists
        if (!devices[deviceHash].exists) {
            revert DeviceNotFound(deviceHash);
        }
        
        // Check if app exists
        if (!deviceApps[deviceHash][appId].exists) {
            revert AppNotFound(deviceHash, appId);
        }
        
        uint8 oldPermission = deviceApps[deviceHash][appId].permission;
        deviceApps[deviceHash][appId].permission = newPermission;
        
        emit AppPermissionUpdated(deviceHash, appId, oldPermission, newPermission);
    }
    
    /// @notice Get device information
    /// @param deviceHash The hash of the device
    /// @return Device information
    function getDevice(bytes32 deviceHash) external view returns (Device memory) {
        if (!devices[deviceHash].exists) {
            revert DeviceNotFound(deviceHash);
        }
        return devices[deviceHash];
    }
    
    /// @notice Get app permission for a device
    /// @param deviceHash The hash of the device
    /// @param appId The app identifier
    /// @return App permission information
    function getAppPermission(bytes32 deviceHash, string calldata appId) external view returns (AppPermission memory) {
        if (!devices[deviceHash].exists) {
            revert DeviceNotFound(deviceHash);
        }
        return deviceApps[deviceHash][appId];
    }
    
    /// @notice Get all app IDs for a device
    /// @param deviceHash The hash of the device
    /// @return Array of app IDs
    function getDeviceAppIds(bytes32 deviceHash) external view returns (string[] memory) {
        if (!devices[deviceHash].exists) {
            revert DeviceNotFound(deviceHash);
        }
        return deviceAppIds[deviceHash];
    }
    
    /// @notice Get app count for a device
    /// @param deviceHash The hash of the device
    /// @return Number of apps on the device
    function getDeviceAppCount(bytes32 deviceHash) external view returns (uint256) {
        if (!devices[deviceHash].exists) {
            revert DeviceNotFound(deviceHash);
        }
        return deviceAppIds[deviceHash].length;
    }
    
    /// @notice Get all device hashes for the user
    /// @return Array of device hashes
    function getAllDeviceHashes() external view returns (bytes32[] memory) {
        return deviceHashes;
    }
    
    /// @notice Get device count
    /// @return Number of devices
    function getDeviceCount() external view returns (uint256) {
        return deviceHashes.length;
    }
    
    /// @notice Verify proof with nullifier hash
    function _verifyProof(
        address signal,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) internal {
        // Check if nullifier has been used
        if (nullifierHashes[nullifierHash]) {
            revert DuplicateNullifier(nullifierHash);
        }
        
        // Verify the proof
        uniqueId.verifyProof(
            root,
            groupId,
            abi.encodePacked(signal).hashToField(),
            nullifierHash,
            0, // externalNullifier - set to 0 since we removed app/action IDs
            proof
        );
        
        // Mark nullifier as used
        nullifierHashes[nullifierHash] = true;
    }
    
    /// @notice Convert label to node
    function _labelToNode(string memory label) private view returns (bytes32) {
        return registryContract.makeNode(registryContract.baseNode(), label);
    }
    
    /// @notice Get registry contract
    function registry() external view returns (IL2Registry) {
        return registryContract;
    }
}
