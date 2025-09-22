// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IUniqueId} from "./interfaces/IUniqueId.sol";

/// @dev Mock implementation of IUniqueId for testing purposes
contract MockUniqueId is IUniqueId {
    
    /// @notice Mock implementation that always returns true for testing
    /// @param root The root of the Merkle tree
    /// @param groupId The id of the Semaphore group
    /// @param signalHash A keccak256 hash of the Semaphore signal
    /// @param nullifierHash The nullifier hash
    /// @param externalNullifierHash A keccak256 hash of the external nullifier
    /// @param proof The zero-knowledge proof
    function verifyProof(
        uint256 root,
        uint256 groupId,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256 externalNullifierHash,
        uint256[8] calldata proof
    ) external pure override {    
        return;
    }
}
