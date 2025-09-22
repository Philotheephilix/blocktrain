// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title L2AddressDeriver
/// @notice Helper contract to derive L2 addresses from L1 addresses for different L2 networks
contract L2AddressDeriver {
    enum L2Network {
        BASE,
        ARBITRUM,
        OPTIMISM,
        WORLDCHAIN,
        POLYGON,
        GENERIC
    }

    error UnsupportedL2Network(L2Network network);

    /// @notice Derives L2 address from L1 address based on the L2 network
    /// @param l1Address The L1 address to derive from
    /// @param network The L2 network type
    /// @return l2Address The derived L2 address
    function deriveL2Address(
        address l1Address,
        L2Network network
    ) external pure returns (address l2Address) {
        if (network == L2Network.BASE || 
            network == L2Network.ARBITRUM || 
            network == L2Network.OPTIMISM ||
            network == L2Network.WORLDCHAIN ||
            network == L2Network.GENERIC) {
            // For most L2s, EOA addresses are preserved (same as L1)
            return l1Address;
        } else if (network == L2Network.POLYGON) {
            // Polygon uses the same address derivation as Ethereum
            return l1Address;
        } else {
            revert UnsupportedL2Network(network);
        }
    }

    /// @notice Derives L2 address from L1 address using chain ID
    /// @param l1Address The L1 address to derive from
    /// @param chainId The L2 chain ID
    /// @return l2Address The derived L2 address
    function deriveL2AddressByChainId(
        address l1Address,
        uint256 chainId
    ) external pure returns (address l2Address) {
        // Map chain IDs to networks
        if (chainId == 84532 || chainId == 8453) { // Base Sepolia/Mainnet
            return l1Address;
        } else if (chainId == 421614 || chainId == 42161) { // Arbitrum Sepolia/Mainnet
            return l1Address;
        } else if (chainId == 11155420 || chainId == 10) { // Optimism Sepolia/Mainnet
            return l1Address;
        } else if (chainId == 4801 || chainId == 480) { // Worldchain Sepolia/Mainnet
            return l1Address;
        } else if (chainId == 137 || chainId == 80001) { // Polygon Mainnet/Mumbai
            return l1Address;
        } else {
            // Default: assume same address for unknown L2s
            return l1Address;
        }
    }

    /// @notice Gets the L2 network type from chain ID
    /// @param chainId The chain ID
    /// @return network The corresponding L2 network type
    function getNetworkFromChainId(uint256 chainId) external pure returns (L2Network network) {
        if (chainId == 84532 || chainId == 8453) {
            return L2Network.BASE;
        } else if (chainId == 421614 || chainId == 42161) {
            return L2Network.ARBITRUM;
        } else if (chainId == 11155420 || chainId == 10) {
            return L2Network.OPTIMISM;
        } else if (chainId == 4801 || chainId == 480) {
            return L2Network.WORLDCHAIN;
        } else if (chainId == 137 || chainId == 80001) {
            return L2Network.POLYGON;
        } else {
            return L2Network.GENERIC;
        }
    }
}
