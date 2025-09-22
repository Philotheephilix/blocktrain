// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev Interface for UserDeviceManagerFactory contract
interface IUserDeviceManagerFactory {
    
    /// @notice Emitted when a new user device manager is deployed
    event UserDeviceManagerDeployed(
        address indexed userAddress,
        string indexed ensDomain,
        address indexed contractAddress,
        uint256 userNullifierHash
    );
    
    /// @notice Deploy a new user device manager contract
    function deployUserDeviceManager(
        address userAddress,
        string calldata ensDomain,
        uint256 userNullifierHash
    ) external returns (address);
    
    /// @notice Get the contract address for a user
    function getUserContract(address userAddress) external view returns (address);
    
    /// @notice Get the user address for an ENS domain
    function getUserByDomain(string calldata ensDomain) external view returns (address);
    
    /// @notice Get the contract address for an ENS domain
    function getContractByDomain(string calldata ensDomain) external view returns (address);
    
    /// @notice Check if a user has a deployed contract
    function hasUserContract(address userAddress) external view returns (bool);
    
    /// @notice Check if a domain is registered
    function isDomainRegistered(string calldata ensDomain) external view returns (bool);
    
    /// @notice Get the total number of deployed contracts
    function getTotalContracts() external view returns (uint256);
    
    /// @notice Get all deployed contract addresses
    function getAllContracts() external view returns (address[] memory);
    
    /// @notice Get contract address at a specific index
    function getContractAtIndex(uint256 index) external view returns (address);
}
