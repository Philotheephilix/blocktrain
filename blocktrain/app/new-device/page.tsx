"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Wallet, Shield, CheckCircle, AlertCircle, Globe, Lock } from "lucide-react"
import { ethers } from "ethers"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

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

export default function RegisterPage() {
  // Local state (replacing useWallet hook)
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [ensName, setEnsName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasENS, setHasENS] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [labelInput, setLabelInput] = useState<string>("")
  const [resultOpen, setResultOpen] = useState(false)
  const [resultContent, setResultContent] = useState<string>("")

  // External RPC providers (read-only to avoid MetaMask rate limits)
  const BASE_SEPOLIA_RPC = "https://sepolia.base.org"
  const SEPOLIA_RPC = "https://rpc.sepolia.org"
  const baseExtProvider = useMemo(() => new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC), [])
  const l1ExtProvider = useMemo(() => new ethers.JsonRpcProvider(SEPOLIA_RPC), [])

  // --- Helpers: retry/backoff and waits ---
  const inFlightRef = useRef(false)

  const clearError = () => setError(null)

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const SHORT_GAP_MS = 300
  const LONG_GAP_MS = 1500

  async function withRetry<T>(fn: () => Promise<T>, opts?: { retries?: number; baseDelayMs?: number }) {
    const retries = opts?.retries ?? 4
    const baseDelayMs = opts?.baseDelayMs ?? 600
    let lastError: any
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn()
      } catch (e: any) {
        lastError = e
        const code = e?.code
        const message: string = e?.message || ""
        const isCircuitOpen =
          code === -32603 &&
          (message.includes("circuit breaker is open") ||
            e?.data?.cause?.isBrokenCircuitError ||
            e?.data?.message?.includes?.("circuit breaker"))
        const isRateLimited = message.toLowerCase().includes("rate limit") || message.includes("-32005")
        const isRetryable = isCircuitOpen || isRateLimited
        if (attempt < retries && isRetryable) {
          const delay = baseDelayMs * Math.pow(2, attempt)
          await sleep(delay)
          continue
        }
        break
      }
    }
    throw lastError
  }

  const getCurrentChainId = async (): Promise<number | null> => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const idHex = await withRetry(() => window.ethereum!.request({ method: "eth_chainId" }))
        return parseInt(idHex, 16)
      } catch (e) {
        console.error("Error getting chain ID:", e)
        return null
      }
    }
    return null
  }

  async function waitForChain(targetHexChainId: string, opts?: { timeoutMs?: number; pollMs?: number }) {
    const timeoutMs = opts?.timeoutMs ?? 20_000
    const pollMs = opts?.pollMs ?? 300
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const idHex = await window.ethereum!.request({ method: "eth_chainId" })
        if (idHex?.toLowerCase() === targetHexChainId.toLowerCase()) return true
      } catch {}
      await sleep(pollMs)
    }
    return false
  }

  async function ensureProviderReady(provider: ethers.AbstractProvider) {
    try {
      await withRetry(() => provider.getBlockNumber(), { retries: 5, baseDelayMs: 700 })
      await sleep(SHORT_GAP_MS)
    } catch (e) {
      console.warn("Provider readiness check failed:", e)
    }
  }

  async function sendMetaMaskTx(params: { to?: string; data: string; valueHex?: string }) {
    if (!address) throw new Error("Wallet not connected")
    const tx: any = { from: address, data: params.data }
    if (params.to) tx.to = params.to
    if (params.valueHex) tx.value = params.valueHex
    const hash = await withRetry(() => window.ethereum!.request({ method: "eth_sendTransaction", params: [tx] }), {
      retries: 6,
      baseDelayMs: 800,
    })
    return hash as string
  }

  const lookupENSFromAPI = async (addr: string, currentChainId: number) => {
    try {
      const network = currentChainId === 11155111 ? "Sepolia" : "Ethereum"
      const res = await fetch(`/api/ens?address=${addr}&network=${network}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0]
        setEnsName(first?.name ?? null)
        setHasENS(!!first?.name)
      } else {
        setEnsName(null)
        setHasENS(false)
      }
    } catch (e) {
      console.error("ENS API lookup failed:", e)
      setEnsName(null)
      setHasENS(false)
    }
  }

  const checkWalletConnection = async () => {
    if (typeof window === "undefined" || !window.ethereum) return
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.listAccounts()
      if (accounts.length > 0) {
        const addr = accounts[0].address
        const id = await getCurrentChainId()
        setIsConnected(true)
        setAddress(addr)
        setIsLoading(false)
        setError(null)
        if (id === 1 || id === 11155111) {
          await lookupENSFromAPI(addr, id)
        } else {
          await lookupENSFromAPI(addr, 1)
        }
      }
    } catch (e) {
      console.error("Error checking wallet connection:", e)
    }
  }

  const connectWallet = async () => {
    if (typeof window === "undefined") {
      setError("This application requires a browser environment.")
      return
    }
    if (!window.ethereum) {
      setError("MetaMask (or compatible wallet) not found.")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const accounts = await withRetry(() => window.ethereum!.request({ method: "eth_requestAccounts" }))
      if (accounts && accounts.length > 0) {
        const addr = accounts[0]
        const id = await getCurrentChainId()
        setIsConnected(true)
        setAddress(addr)
        setIsLoading(false)
        if (id === 1 || id === 11155111) {
          await lookupENSFromAPI(addr, id)
        } else {
          await lookupENSFromAPI(addr, 1)
        }
      } else {
        setIsLoading(false)
        setError("No accounts found. Please unlock your wallet.")
      }
    } catch (err: any) {
      console.error("Wallet connection error:", err)
      let msg = "Failed to connect wallet"
      if (err?.code === 4001) msg = "User rejected the connection request"
      else if (err?.code === -32002) msg = "Connection request already pending. Check your wallet."
      else if (err?.message) msg = err.message
      setIsLoading(false)
      setError(msg)
    }
  }

  // Switch to Base Sepolia
  const switchToBaseSepolia = async () => {
    const target = "0x14a34"
    try {
      const current = await withRetry(() => window.ethereum!.request({ method: "eth_chainId" }))
      if (current?.toLowerCase() === target) {
        await sleep(SHORT_GAP_MS)
        return
      }
    } catch {}
    try {
      await withRetry(() => window.ethereum!.request({ method: "wallet_switchEthereumChain", params: [{ chainId: target }] }))
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await withRetry(() =>
            window.ethereum!.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: target,
                  chainName: "Base Sepolia",
                  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
                  rpcUrls: [BASE_SEPOLIA_RPC],
                  blockExplorerUrls: ["https://sepolia.basescan.org"],
                },
              ],
            })
          )
        } catch (addError) {
          console.error("Failed to add Base Sepolia network:", addError)
          throw new Error("Failed to add Base Sepolia network")
        }
      } else {
        console.error("Failed to switch to Base Sepolia:", switchError)
        throw new Error("Failed to switch to Base Sepolia network")
      }
    }
    await waitForChain(target)
    await sleep(LONG_GAP_MS)
  }

  // Switch back to Sepolia (L1)
  const switchToSepolia = async () => {
    const target = "0xaa36a7"
    try {
      const current = await withRetry(() => window.ethereum!.request({ method: "eth_chainId" }))
      if (current?.toLowerCase() === target) {
        await sleep(SHORT_GAP_MS)
        return
      }
    } catch {}
    try {
      await withRetry(() => window.ethereum!.request({ method: "wallet_switchEthereumChain", params: [{ chainId: target }] }))
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await withRetry(() =>
            window.ethereum!.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: target,
                  chainName: "Sepolia",
                  nativeCurrency: { name: "SepoliaETH", symbol: "SepoliaETH", decimals: 18 },
                  rpcUrls: [SEPOLIA_RPC],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            })
          )
        } catch (addError) {
          console.error("Error adding Sepolia network:", addError)
          throw new Error("Failed to add Sepolia network")
        }
      } else {
        console.error("Error switching to Sepolia:", switchError)
        throw new Error("Failed to switch to Sepolia network")
      }
    }
    await waitForChain(target)
    await sleep(LONG_GAP_MS)
  }

  const extractLogData = (receipt: any) => {
    let node: string | null = null
    let registry: string | null = null
    const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    const registryDeployedEventSignature = "0x2ee60cfa4375b5b9423ac404e920bd8ae8f78d7742602aa26a9b62d7aa65be5b"

    const registryIface = new ethers.Interface([
      "event RegistryDeployed(string name, address admin, address registry)",
    ])

    for (const log of receipt.logs) {
      if (log.topics && log.topics[0] === transferEventSignature && log.topics[3]) {
        node = log.topics[3]
      }
      if (log.topics && log.topics[0] === registryDeployedEventSignature) {
        try {
          const parsed = registryIface.parseLog({ topics: log.topics, data: log.data })
          const decodedRegistry = parsed?.args?.registry as string | undefined
          if (decodedRegistry) {
            registry = ethers.getAddress(decodedRegistry)
          }
        } catch (e) {
          console.error("Failed to decode RegistryDeployed log:", e)
        }
      }
    }

    return { node, registry }
  }

  const runFullFlow = async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      if (!isConnected || !address) throw new Error("Connect wallet first")
      if (!hasENS || !ensName) throw new Error("ENS not found for this address")
      const label = labelInput.trim()
      if (!label) throw new Error("Enter a label to register")

      setIsRegistering(true)

      // 1) Switch to Base and call deployRegistry
      await switchToBaseSepolia()
      await ensureProviderReady(baseExtProvider)
      await sleep(LONG_GAP_MS)

      const l2RegistryAddr = process.env.NEXT_PUBLIC_L2_REGISTRY
      if (!l2RegistryAddr) throw new Error("L2 Registry contract address not configured")
      const l2RegistryIface = new ethers.Interface([
        "function deployRegistry(string name, string symbol, string baseURI, address admin)",
        "function addRegistrar(address registrar)",
      ])
      const deployData = l2RegistryIface.encodeFunctionData("deployRegistry", [ensName, ensName, "", address])

      const deployHash = await sendMetaMaskTx({ to: l2RegistryAddr, data: deployData })
      const deployReceipt = await baseExtProvider.waitForTransaction(deployHash)
      const { node, registry } = extractLogData(deployReceipt)
      if (!node || !registry) throw new Error("Failed to extract node/registry from Base tx logs")

      await sleep(LONG_GAP_MS)

      // 2) Switch to Sepolia and call L1 resolver setL2Registry
      await switchToSepolia()
      await ensureProviderReady(l1ExtProvider)
      await sleep(LONG_GAP_MS)

      const l1ResolverAddress = process.env.NEXT_PUBLIC_L1_RESOLVER
      if (!l1ResolverAddress) throw new Error("L1 Resolver contract address not configured (NEXT_PUBLIC_L1_RESOLVER)")
      const l1ResolverIface = new ethers.Interface([
        "function setL2Registry(bytes32 node, uint64 targetChainId, address targetRegistryAddress)",
      ])
      const targetChainId: bigint = BigInt(84532)
      const setData = l1ResolverIface.encodeFunctionData("setL2Registry", [node, targetChainId, registry])
      const setHash = await sendMetaMaskTx({ to: l1ResolverAddress, data: setData })
      await l1ExtProvider.waitForTransaction(setHash)

      await sleep(LONG_GAP_MS)

      // 3) Switch back to Base, deploy L2Registrar(registry) and addRegistrar
      await switchToBaseSepolia()
      await ensureProviderReady(baseExtProvider)
      await sleep(LONG_GAP_MS)

      const bytecode = process.env.NEXT_PUBLIC_L2_REGISTRAR_BYTECODE
      if (!bytecode || !bytecode.startsWith("0x")) throw new Error("Missing or invalid NEXT_PUBLIC_L2_REGISTRAR_BYTECODE")
      const ctorIface = new ethers.Interface(["constructor(address _registry)"])
      const encodedCtor = ctorIface.encodeDeploy([registry])
      const registrarDeployData = bytecode + encodedCtor.slice(2)

      const registrarHash = await sendMetaMaskTx({ data: registrarDeployData })
      const registrarReceipt = await baseExtProvider.waitForTransaction(registrarHash)
      const registrarAddress = registrarReceipt?.contractAddress
      if (!registrarAddress) throw new Error("Failed to get registrar address from receipt")

      await sleep(LONG_GAP_MS)

      const addRegistrarData = l2RegistryIface.encodeFunctionData("addRegistrar", [registrarAddress])
      const addRegistrarHash = await sendMetaMaskTx({ to: l2RegistryAddr, data: addRegistrarData })
      await baseExtProvider.waitForTransaction(addRegistrarHash)

      await sleep(LONG_GAP_MS)

      // 4) Register label on L2 Registrar
      const registrarIface = new ethers.Interface(["function register(string label, address owner)"])
      const registerData = registrarIface.encodeFunctionData("register", [label, address])
      const regHash = await sendMetaMaskTx({ to: registrarAddress, data: registerData })
      await baseExtProvider.waitForTransaction(regHash)

      // Final modal summary
      const summary = [
        `L2 deployRegistry tx: ${deployHash}`,
        `Extracted node: ${node}`,
        `Extracted registry: ${registry}`,
        `L1 setL2Registry tx: ${setHash}`,
        `L2 L2Registrar deployed: ${registrarAddress}`,
        `L2 addRegistrar tx: ${addRegistrarHash}`,
        `L2 register(label) tx: ${regHash}`,
      ].join("\n")
      setResultContent(summary)
      setResultOpen(true)
    } catch (e: any) {
      alert(`Full flow failed: ${e?.message || String(e)}`)
    } finally {
      setIsRegistering(false)
      inFlightRef.current = false
    }
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  // On mount, check wallet connection (and trigger ENS API)
  useEffect(() => {
    checkWalletConnection()
  }, [])

  // Listen for account/chain changes to re-check
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setIsConnected(false)
        setAddress(null)
        setEnsName(null)
        setHasENS(false)
      } else {
        checkWalletConnection()
      }
    }
    const handleChainChanged = () => checkWalletConnection()
    window.ethereum.on("accountsChanged", handleAccountsChanged)
    window.ethereum.on("chainChanged", handleChainChanged)
    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged)
      window.ethereum?.removeListener("chainChanged", handleChainChanged)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 z-0">
        <svg width="100%" height="100%" viewBox="0 0 1220 810" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <g clipPath="url(#clip0_register)">
            <mask id="mask0_register" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="10" y="-1" width="1200" height="812">
              <rect x="10" y="-0.84668" width="1200" height="811.693" fill="url(#paint0_linear_register)" />
            </mask>
            <g mask="url(#mask0_register)">
              {[...Array(20)].map((_, i) => (
                <React.Fragment key={`row-${i}`}>
                  <rect x={-20 + i * 60} y={20 + i * 40} width="59" height="39" stroke="hsl(var(--foreground))" strokeOpacity="0.05" strokeWidth="0.5" strokeDasharray="2 2" />
                </React.Fragment>
              ))}
            </g>
            <rect x="0.5" y="0.5" width="1219" height="809" rx="15.5" stroke="hsl(var(--foreground))" strokeOpacity="0.06" />
          </g>
          <defs>
            <linearGradient id="paint0_linear_register" x1="35.0676" y1="23.6807" x2="903.8" y2="632.086" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--foreground))" stopOpacity="0" />
              <stop offset="1" stopColor="hsl(var(--muted-foreground))" />
            </linearGradient>
            <clipPath id="clip0_register">
              <rect width="1220" height="810" rx="16" fill="hsl(var(--foreground))" />
            </clipPath>
          </defs>
        </svg>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md">
          <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-semibold">Register Your Device</CardTitle>
              <CardDescription>Connect your wallet to register with your ENS domain and secure your decentralized identity.</CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {!isConnected ? (
                  <div className="text-center space-y-4">
                    <Button onClick={connectWallet} disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" size="lg">
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4" />
                          Connect Wallet
                        </>
                      )}
                    </Button>
                    {typeof window !== "undefined" && !window.ethereum && (
                      <div className="text-center space-y-2">
                        <p className="text-sm text-muted-foreground">Don't have a wallet? Install MetaMask:</p>
                        <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 text-sm underline">Download MetaMask</a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-muted-foreground">Wallet Address</span>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                      <p className="font-mono text-sm">{formatAddress(address!)}</p>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-muted-foreground">ENS Domain</span>
                        {hasENS ? (
                          <Badge variant="destructive" className="bg-destructive/10 text-destructive">
                            <Globe className="w-3 h-3 mr-1" />
                            Found
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-500 border-red-500">Not Found</Badge>
                        )}
                      </div>
                      {hasENS ? (
                        <div className="space-y-2">
                          <p className="font-semibold text-destructive">{ensName}</p>
                          <p className="text-xs text-muted-foreground">✓ ENS domain found - you can proceed</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">No ENS domain found for this address.</p>
                          <Alert className="bg-red-500/10 border-red-500/20">
                            <Lock className="h-4 w-4 text-red-500" />
                            <AlertDescription className="text-red-700 dark:text-red-300">
                            You must own an ENS domain to register an account. Please acquire an ENS domain first.
                            <Button variant="link" className="text-primary hover:text-primary/80 text-sm underline" onClick={() => window.open("https://sepolia.app.ens.domains/", "_blank")}>
                              Buy an ENS domain
                            </Button>
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}
                    </div>

                    {/* Label input */}
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter label (e.g., blocktrain-test)"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                      />
                    </div>

                    {/* Single combined action button */}
                    <Button onClick={runFullFlow} disabled={isRegistering || !hasENS || !labelInput.trim()} className={`w-full text-primary-foreground ${hasENS && labelInput.trim() ? "bg-primary hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed"}`} size="lg">
                      {isRegistering ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Registering Device On Chain...
                        </>
                      ) : (
                        "Register Device"
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{error}</span>
                    <Button variant="ghost" size="sm" onClick={clearError} className="h-auto p-1 text-destructive-foreground hover:text-destructive-foreground/80">×</Button>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Final summary modal */}
      <AlertDialog open={resultOpen} onOpenChange={setResultOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Setup Complete</AlertDialogTitle>
            <AlertDialogDescription>
              <pre className="whitespace-pre-wrap break-words text-xs">{resultContent}</pre>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
