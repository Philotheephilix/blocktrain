// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IUserDeviceManagerFactory} from "./interfaces/IUserDeviceManagerFactory.sol";
import {IUniqueId} from "./interfaces/IUniqueId.sol";
import {IL2Registry} from "./interfaces/IL2Registry.sol";
import "./UserDeviceManager.sol";

/// @dev Factory contract for deploying user-specific device manager contracts
contract UserDeviceManagerFactory is IUserDeviceManagerFactory {
    
    /// @dev The unique ID instance for proof verification
    IUniqueId public immutable uniqueId;
    
    /// @dev The L2Registry contract
    IL2Registry public immutable registry;
    
    /// @dev Owner of the factory
    address public immutable owner;
    
    /// @dev Mapping from user address to their device manager contract
    mapping(address => address) public userContracts;
    
    /// @dev Mapping from ENS domain to user address
    mapping(string => address) public domainToUser;
    
    /// @dev Array of all deployed contracts
    address[] public allContracts;
    
    error UserAlreadyHasContract(address userAddress);
    error DomainAlreadyRegistered(string ensDomain);
    error Unauthorized();
    error ContractNotFound(address userAddress);
    
    /// @notice Initializes the factory
    /// @param _uniqueId The uniqueID router for proof verification
    /// @param _registry Address of the L2Registry contract
    /// @param _owner The owner of this factory
    constructor(
        IUniqueId _uniqueId,
        address _registry,
        address _owner
    ) {
        uniqueId = _uniqueId;
        registry = IL2Registry(_registry);
        owner = _owner;
    }
    
    /// @notice Deploy a new user device manager contract
    /// @param userAddress The user's address
    /// @param ensDomain The user's ENS domain name
    /// @param userNullifierHash The user's nullifier hash
    /// @return The address of the deployed contract
    function deployUserDeviceManager(
        address userAddress,
        string calldata ensDomain,
        uint256 userNullifierHash
    ) external returns (address) {
        // Only owner can deploy contracts
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        
        // Check if user already has a contract
        if (userContracts[userAddress] != address(0)) {
            revert UserAlreadyHasContract(userAddress);
        }
        
        // Check if domain is already registered
        if (domainToUser[ensDomain] != address(0)) {
            revert DomainAlreadyRegistered(ensDomain);
        }
        
        // Deploy the user device manager contract
        UserDeviceManager newContract = new UserDeviceManager(
            uniqueId,
            address(registry),
            userAddress,
            ensDomain,
            userNullifierHash
        );
        
        address contractAddress = address(newContract);
        
        // Store the contract address
        userContracts[userAddress] = contractAddress;
        domainToUser[ensDomain] = userAddress;
        allContracts.push(contractAddress);
        
        emit UserDeviceManagerDeployed(
            userAddress,
            ensDomain,
            contractAddress,
            userNullifierHash
        );
        
        return contractAddress;
    }
    
    /// @notice Get the contract address for a user
    /// @param userAddress The user's address
    /// @return The address of the user's device manager contract
    function getUserContract(address userAddress) external view returns (address) {
        address contractAddress = userContracts[userAddress];
        if (contractAddress == address(0)) {
            revert ContractNotFound(userAddress);
        }
        return contractAddress;
    }
    
    /// @notice Get the user address for an ENS domain
    /// @param ensDomain The ENS domain name
    /// @return The user's address
    function getUserByDomain(string calldata ensDomain) external view returns (address) {
        address userAddress = domainToUser[ensDomain];
        if (userAddress == address(0)) {
            revert ContractNotFound(userAddress);
        }
        return userAddress;
    }
    
    /// @notice Get the contract address for an ENS domain
    /// @param ensDomain The ENS domain name
    /// @return The address of the user's device manager contract
    function getContractByDomain(string calldata ensDomain) external view returns (address) {
        address userAddress = domainToUser[ensDomain];
        if (userAddress == address(0)) {
            revert ContractNotFound(userAddress);
        }
        return userContracts[userAddress];
    }
    
    /// @notice Check if a user has a deployed contract
    /// @param userAddress The user's address
    /// @return True if the user has a contract deployed
    function hasUserContract(address userAddress) external view returns (bool) {
        return userContracts[userAddress] != address(0);
    }
    
    /// @notice Check if a domain is registered
    /// @param ensDomain The ENS domain name
    /// @return True if the domain is registered
    function isDomainRegistered(string calldata ensDomain) external view returns (bool) {
        return domainToUser[ensDomain] != address(0);
    }
    
    /// @notice Get the total number of deployed contracts
    /// @return The number of deployed contracts
    function getTotalContracts() external view returns (uint256) {
        return allContracts.length;
    }
    
    /// @notice Get all deployed contract addresses
    /// @return Array of all contract addresses
    function getAllContracts() external view returns (address[] memory) {
        return allContracts;
    }
    
    /// @notice Get contract address at a specific index
    /// @param index The index in the allContracts array
    /// @return The contract address at the given index
    function getContractAtIndex(uint256 index) external view returns (address) {
        require(index < allContracts.length, "Index out of bounds");
        return allContracts[index];
    }
}
