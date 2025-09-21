"use client"

import { useState, useCallback } from "react"
import { ethers } from "ethers"
import { resolveENSName, isENSAvailableOnNetwork } from "@/lib/ens-utils"

interface ENSResult {
  name: string | null
  isLoading: boolean
  error: string | null
}

export function useENS() {
  const [ensResult, setEnsResult] = useState<ENSResult>({
    name: null,
    isLoading: false,
    error: null
  })

  const resolveENS = useCallback(async (address: string, provider: ethers.BrowserProvider, chainId?: number): Promise<string | null> => {
    if (!address || !provider) return null

    // Check if ENS is available on the current network
    if (chainId && !isENSAvailableOnNetwork(chainId)) {
      console.log(`ENS not available on chain ${chainId}`)
      setEnsResult({
        name: null,
        isLoading: false,
        error: null
      })
      return null
    }

    setEnsResult(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await resolveENSName(address, provider, chainId)
      
      setEnsResult({
        name: result.name,
        isLoading: false,
        error: result.success ? null : result.error || "ENS resolution failed"
      })
      
      return result.name
    } catch (error: any) {
      console.log("ENS resolution error:", error)
      
      setEnsResult({
        name: null,
        isLoading: false,
        error: null // Don't show error to user, just log it
      })
      
      return null
    }
  }, [])

  const clearENS = useCallback(() => {
    setEnsResult({
      name: null,
      isLoading: false,
      error: null
    })
  }, [])

  return {
    ...ensResult,
    resolveENS,
    clearENS
  }
}
