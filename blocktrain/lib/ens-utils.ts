import { ethers } from "ethers"

// Network configurations
const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: "Sepolia",
    rpcUrl: "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    publicRpc: "https://rpc.sepolia.org"
  },
  mainnet: {
    chainId: 1,
    name: "Ethereum",
    rpcUrl: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    publicRpc: "https://eth.llamarpc.com"
  }
}

export interface ENSResolutionResult {
  name: string | null
  success: boolean
  error?: string
}

/**
 * Get current network configuration
 */
export function getCurrentNetwork(chainId?: number) {
  if (chainId === 11155111) {
    return NETWORKS.sepolia
  }
  return NETWORKS.mainnet
}

/**
 * Resolve ENS name for an address using the provider's lookupAddress method
 * Simple and direct approach
 */
export async function resolveENSName(
  address: string, 
  provider: ethers.Provider,
  chainId?: number
): Promise<ENSResolutionResult> {
  if (!address || !provider) {
    return { name: null, success: false, error: "Invalid address or provider" }
  }

  const currentNetwork = getCurrentNetwork(chainId)
  console.log(`Resolving ENS on ${currentNetwork.name} (Chain ID: ${currentNetwork.chainId})`)

  try {
    // Simple direct lookup using provider.lookupAddress
    const result = await provider.lookupAddress(address)
    console.log(`ENS lookup result for ${address}:`, result)
    
    return { name: result, success: true }
  } catch (error: any) {
    console.log(`ENS lookup failed on ${currentNetwork.name}:`, error.message)
    return { name: null, success: false, error: error.message }
  }
}

/**
 * Check if a string is a valid ENS name
 */
export function isValidENSName(name: string): boolean {
  if (!name || typeof name !== 'string') return false
  
  // Basic ENS name validation
  const ensRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.eth$/i
  return ensRegex.test(name)
}

/**
 * Get the reverse namehash for an address
 */
export function getReverseNamehash(address: string): string {
  return ethers.namehash(address.toLowerCase() + ".addr.reverse")
}

/**
 * Format address for display
 */
export function formatAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (!address || address.length < startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Get network info for display
 */
export function getNetworkInfo(chainId: number) {
  const network = getCurrentNetwork(chainId)
  return {
    name: network.name,
    chainId: network.chainId,
    isTestnet: chainId === 11155111
  }
}

/**
 * Check if ENS is available on the current network
 */
export function isENSAvailableOnNetwork(chainId: number): boolean {
  // ENS is available on mainnet and some testnets like Sepolia
  return chainId === 1 || chainId === 11155111
}
