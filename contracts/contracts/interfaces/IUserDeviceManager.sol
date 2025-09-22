// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev Interface for UserDeviceManager contract
interface IUserDeviceManager {
    
    /// @dev Device information structure
    struct Device {
        string model;
        string subdomain; // e.g., "model.ens.eth"
        address deviceAddress;
        uint256 deviceNullifier;
        bool exists;
    }
    
    /// @dev App permission structure
    struct AppPermission {
        uint8 permission; // 0/1/2/3
        bool exists;
    }
    
    /// @notice Emitted when a new device is added
    event DeviceAdded(
        bytes32 indexed deviceHash,
        string indexed model,
        string subdomain,
        address deviceAddress,
        uint256 deviceNullifier
    );
    
    /// @notice Emitted when an app is added to a device
    event AppAdded(
        bytes32 indexed deviceHash,
        string indexed appId,
        uint8 permission
    );
    
    /// @notice Emitted when app permission is updated
    event AppPermissionUpdated(
        bytes32 indexed deviceHash,
        string indexed appId,
        uint8 oldPermission,
        uint8 newPermission
    );
    
    /// @notice Get the user's ENS domain name
    function ensDomain() external view returns (string memory);
    
    /// @notice Get the user's address
    function userAddress() external view returns (address);
    
    /// @notice Get the user's nullifier hash
    function userNullifierHash() external view returns (uint256);
    
    /// @notice Add a new device with model and create subdomain
    function addDevice(
        string calldata model,
        address deviceAddress,
        uint256 deviceNullifier,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external;
    
    /// @notice Add an app to a device with permission
    function addAppToDevice(
        bytes32 deviceHash,
        string calldata appId,
        uint8 permission
    ) external;
    
    /// @notice Update app permission for a device
    function updateAppPermission(
        bytes32 deviceHash,
        string calldata appId,
        uint8 newPermission
    ) external;
    
    /// @notice Get device information
    function getDevice(bytes32 deviceHash) external view returns (Device memory);
    
    /// @notice Get app permission for a device
    function getAppPermission(bytes32 deviceHash, string calldata appId) external view returns (AppPermission memory);
    
    /// @notice Get all app IDs for a device
    function getDeviceAppIds(bytes32 deviceHash) external view returns (string[] memory);
    
    /// @notice Get app count for a device
    function getDeviceAppCount(bytes32 deviceHash) external view returns (uint256);
    
    /// @notice Get all device hashes for the user
    function getAllDeviceHashes() external view returns (bytes32[] memory);
    
    /// @notice Get device count
    function getDeviceCount() external view returns (uint256);
}
