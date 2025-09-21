"use client"

import { useState, useEffect, useCallback } from "react"
import { ethers } from "ethers"

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, callback: (...args: any[]) => void) => void
      removeListener: (event: string, callback: (...args: any[]) => void) => void
      isMetaMask?: boolean
    }
  }
}

interface WalletState {
  isConnected: boolean
  address: string | null
  ensName: string | null
  chainId: number | null
  networkName: string | null
  isLoading: boolean
  error: string | null
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: null,
    ensName: null,
    chainId: null,
    networkName: null,
    isLoading: false,
    error: null
  })

  const getCurrentChainId = useCallback(async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        return parseInt(chainId, 16)
      } catch (error) {
        console.error("Error getting chain ID:", error)
        return null
      }
    }
    return null
  }, [])

  const lookupENSFromAPI = useCallback(async (address: string, chainId: number) => {
    try {
      const network = chainId === 11155111 ? "Sepolia" : "Ethereum"
      console.log(`Making API call to /api/ens with address: ${address}, network: ${network}`)
      
      const response = await fetch(`/api/ens?address=${address}&network=${network}`)
      console.log(`API response status: ${response.status}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("ENS API response:", data)

      // Check if we have domains and return the first one
      if (Array.isArray(data) && data.length > 0) {
        const firstDomain = data[0]
        console.log("Found ENS domain:", firstDomain)
        return {
          name: firstDomain.name,
          truncatedName: firstDomain.truncatedName,
          labelName: firstDomain.labelName,
          owner: firstDomain.owner,
          wrappedOwner: firstDomain.wrappedOwner,
          relation: firstDomain.relation
        }
      }
      
      console.log("No ENS domains found in response")
      return null
    } catch (error) {
      console.error("ENS API lookup failed:", error)
      return null
    }
  }, [])

  const checkWalletConnection = useCallback(async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await provider.listAccounts()
        
        if (accounts.length > 0) {
          const address = accounts[0].address
          const chainId = await getCurrentChainId()
          
          console.log(`Wallet connected: ${address}, Chain ID: ${chainId}`)
          
          setWallet(prev => ({
            ...prev,
            isConnected: true,
            address,
            chainId,
            networkName: chainId === 11155111 ? "Sepolia" : chainId === 1 ? "Ethereum" : `Chain ${chainId}`,
            isLoading: false,
            error: null
          }))

          // Use our API route for ENS lookup
          if (chainId === 1 || chainId === 11155111) {
            try {
              console.log(`Looking up ENS for ${address} using our API`)
              const ensData = await lookupENSFromAPI(address, chainId)
              console.log(`ENS result:`, ensData)
              
              setWallet(prev => ({
                ...prev,
                ensName: ensData?.name || null
              }))
            } catch (ensError) {
              console.error("ENS lookup failed:", ensError)
              // Don't update state with error, just log it
            }
          } else {
            console.log(`Chain ID ${chainId} not supported for ENS lookup`)
          }
        }
      } catch (error) {
        console.error("Error checking wallet connection:", error)
      }
    }
  }, [getCurrentChainId, lookupENSFromAPI])

  const connectWallet = useCallback(async () => {
    if (typeof window === "undefined") {
      setWallet(prev => ({
        ...prev,
        error: "This application requires a browser environment."
      }))
      return
    }

    if (!window.ethereum) {
      setWallet(prev => ({
        ...prev,
        error: "MetaMask or compatible wallet not found. Please install MetaMask or another Web3 wallet."
      }))
      return
    }

    setWallet(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })
      
      if (accounts && accounts.length > 0) {
        const address = accounts[0]
        const chainId = await getCurrentChainId()
        
        console.log(`Connecting wallet: ${address}, Chain ID: ${chainId}`)
        
        setWallet({
          isConnected: true,
          address,
          ensName: null, // Will be resolved asynchronously
          chainId,
          networkName: chainId === 11155111 ? "Sepolia" : chainId === 1 ? "Ethereum" : `Chain ${chainId}`,
          isLoading: false,
          error: null
        })

        // Use our API route for ENS lookup
        if (chainId === 1 || chainId === 11155111) {
          try {
            console.log(`Looking up ENS for ${address} using our API`)
            const ensData = await lookupENSFromAPI(address, chainId)
            console.log(`ENS result:`, ensData)
            
            setWallet(prev => ({
              ...prev,
              ensName: ensData?.name || null
            }))
          } catch (ensError) {
            console.error("ENS lookup failed:", ensError)
            // Don't show error to user, just continue without ENS name
          }
        } else {
          console.log(`Chain ID ${chainId} not supported for ENS lookup`)
        }
      } else {
        setWallet(prev => ({
          ...prev,
          isLoading: false,
          error: "No accounts found. Please make sure your wallet is unlocked."
        }))
      }
    } catch (error: any) {
      console.error("Wallet connection error:", error)
      
      let errorMessage = "Failed to connect wallet"
      
      if (error.code === 4001) {
        errorMessage = "User rejected the connection request"
      } else if (error.code === -32002) {
        errorMessage = "Connection request already pending. Please check your wallet."
      } else if (error.message) {
        errorMessage = error.message
      }
      
      setWallet(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
    }
  }, [getCurrentChainId, lookupENSFromAPI])

  const switchToSepolia = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia chain ID in hex
      })
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0xaa36a7',
                chainName: 'Sepolia',
                rpcUrls: ['https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'],
                nativeCurrency: {
                  name: 'SepoliaETH',
                  symbol: 'SepoliaETH',
                  decimals: 18,
                },
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              },
            ],
          })
        } catch (addError) {
          console.error("Error adding Sepolia network:", addError)
        }
      } else {
        console.error("Error switching to Sepolia:", switchError)
      }
    }
  }, [])

  const disconnectWallet = useCallback(() => {
    setWallet({
      isConnected: false,
      address: null,
      ensName: null,
      chainId: null,
      networkName: null,
      isLoading: false,
      error: null
    })
  }, [])

  const clearError = useCallback(() => {
    setWallet(prev => ({ ...prev, error: null }))
  }, [])

  // Check wallet connection on mount
  useEffect(() => {
    checkWalletConnection()
  }, [checkWalletConnection])

  // Listen for account and chain changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet()
        } else {
          checkWalletConnection()
        }
      }

      const handleChainChanged = () => {
        checkWalletConnection()
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum?.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [checkWalletConnection, disconnectWallet])

  return {
    ...wallet,
    connectWallet,
    disconnectWallet,
    clearError,
    checkWalletConnection,
    switchToSepolia,
    ensLoading: false, // No longer using separate ENS hook
    isSepolia: wallet.chainId === 11155111,
    isMainnet: wallet.chainId === 1,
    ensAvailable: wallet.chainId === 1 || wallet.chainId === 11155111,
    hasENS: !!wallet.ensName // New property to check if ENS exists
  }
}
