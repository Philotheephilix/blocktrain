"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Wallet, Shield, CheckCircle, AlertCircle, Globe, Info, Lock } from "lucide-react"
import { ethers } from "ethers"
import { Input } from "@/components/ui/input"

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
  const [chainId, setChainId] = useState<number | null>(null)
  const [networkName, setNetworkName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasENS, setHasENS] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [lastNode, setLastNode] = useState<string | null>(null)
  const [lastRegistry, setLastRegistry] = useState<string | null>(null)
  const [lastDeployedRegistrar, setLastDeployedRegistrar] = useState<string | null>(null)
  const [labelInput, setLabelInput] = useState<string>("")
  const [isRegisteringLabel, setIsRegisteringLabel] = useState(false)

  const isSepolia = chainId === 11155111
  const isMainnet = chainId === 1

  // Utils
  const clearError = () => setError(null)

  const getCurrentChainId = async (): Promise<number | null> => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const idHex = await window.ethereum.request({ method: "eth_chainId" })
        return parseInt(idHex, 16)
      } catch (e) {
        console.error("Error getting chain ID:", e)
        return null
      }
    }
    return null
  }

  const lookupENSFromAPI = async (addr: string, currentChainId: number) => {
    try {
      // Use Sepolia or Ethereum only for ENS API context
      const network = currentChainId === 11155111 ? "Sepolia" : "Ethereum"
      console.log(`Making ENS API call → /api/ens?address=${addr}&network=${network}`)
      const res = await fetch(`/api/ens?address=${addr}&network=${network}`)
      console.log("ENS API status:", res.status)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log("ENS API data:", data)
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
        setChainId(id)
        setNetworkName('sepolia')
        setIsLoading(false)
        setError(null)
        if (id === 1 || id === 11155111) {
          await lookupENSFromAPI(addr, id)
        } else {
          // Still attempt ENS on Ethereum context to avoid blocking UI
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
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
      if (accounts && accounts.length > 0) {
        const addr = accounts[0]
        const id = await getCurrentChainId()
        setIsConnected(true)
        setAddress(addr)
        setChainId(id)
        setNetworkName(id === 11155111 ? "Sepolia" : id === 1 ? "Ethereum" : `Chain ${id}`)
        setIsLoading(false)
        // Trigger ENS lookup via API
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

  // Switch to Base Sepolia (keep logic unchanged)
  const switchToBaseSepolia = async () => {
    try {
      await window.ethereum?.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x14a34" }], // Base Sepolia chain ID (as previously used)
      })
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum?.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x14a34",
                chainName: "Base Sepolia",
                nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://sepolia.base.org"],
                blockExplorerUrls: ["https://sepolia.basescan.org"],
              },
            ],
          })
        } catch (addError) {
          console.error("Failed to add Base Sepolia network:", addError)
          throw new Error("Failed to add Base Sepolia network")
        }
      } else {
        console.error("Failed to switch to Base Sepolia:", switchError)
        throw new Error("Failed to switch to Base Sepolia network")
      }
    }
  }

  // Switch back to Sepolia (L1)
  const switchToSepolia = async () => {
    try {
      await window.ethereum?.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // Sepolia chain ID
      })
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum?.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia",
                nativeCurrency: { name: "SepoliaETH", symbol: "SepoliaETH", decimals: 18 },
                rpcUrls: ["https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          })
        } catch (addError) {
          console.error("Error adding Sepolia network:", addError)
          throw new Error("Failed to add Sepolia network")
        }
      } else {
        console.error("Error switching to Sepolia:", switchError)
        throw new Error("Failed to switch to Sepolia network")
      }
    }
  }

  // Extract data from logs (keep logic unchanged)
  const extractLogData = (receipt: any) => {
    let node: string | null = null
    let registry: string | null = null
    const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    const registryDeployedEventSignature = "0x2ee60cfa4375b5b9423ac404e920bd8ae8f78d7742602aa26a9b62d7aa65be5b"

    // Prepare interface to decode RegistryDeployed(string name, address admin, address registry)
    const registryIface = new ethers.Interface([
      "event RegistryDeployed(string name, address admin, address registry)",
    ])

    for (const log of receipt.logs) {
      // Node (ERC721 tokenId) is indexed in topics[3]
      if (log.topics && log.topics[0] === transferEventSignature && log.topics[3]) {
        node = log.topics[3]
      }

      // Decode the registry address via ABI instead of slicing raw data
      if (log.topics && log.topics[0] === registryDeployedEventSignature) {
        try {
          const parsed = registryIface.parseLog({ topics: log.topics, data: log.data })
          const decodedRegistry = parsed?.args?.registry as string | undefined
          if (decodedRegistry) {
            registry = ethers.getAddress(decodedRegistry)
          }
        } catch (e) {
          // Fallback: leave registry as null if decoding fails
          console.error("Failed to decode RegistryDeployed log:", e)
        }
      }
    }

    return { node, registry }
  }

  // Contract call (keep logic unchanged)
  const handleRegisterAccount = async () => {
    if (!isConnected || !address || !ensName) return
    setIsRegistering(true)
    try {
      await switchToBaseSepolia()
      const contractAddress = process.env.NEXT_PUBLIC_L2_REGISTRY
      if (!contractAddress) throw new Error("L2 Registry contract address not configured")
      const provider = new ethers.BrowserProvider(window.ethereum!)
      const signer = await provider.getSigner()
      const contractABI = [
        "function deployRegistry(string name, string symbol, string baseURI, address admin) external",
      ]
      const contract = new ethers.Contract(contractAddress, contractABI, signer)
      const name = ensName
      const symbol = ensName
      const baseURI = ""
      const admin = address
      const tx = await contract.deployRegistry(name, symbol, baseURI, admin)
      const receipt = await tx.wait()
      const { node, registry } = extractLogData(receipt)
      
      // Persist for later actions
      setLastNode(node)
      setLastRegistry(registry)

      // Switch back to Sepolia (L1) and prepare L1 resolver call
      await switchToSepolia()
      const l1ResolverAddress = process.env.NEXT_PUBLIC_L1_RESOLVER
      if (!l1ResolverAddress) {
        throw new Error("L1 Resolver contract address not configured (NEXT_PUBLIC_L1_RESOLVER)")
      }
      if (!node || !registry) {
        throw new Error("Missing node or registry from L2 transaction logs")
      }
      const l1Provider = new ethers.BrowserProvider(window.ethereum!)
      const l1Signer = await l1Provider.getSigner()
      const l1ResolverAbi = [
        "function setL2Registry(bytes32 node, uint64 targetChainId, address targetRegistryAddress) external",
      ]
      const l1Resolver = new ethers.Contract(l1ResolverAddress, l1ResolverAbi, l1Signer)
      const targetChainId: bigint = BigInt(84532)
      const setTx = await l1Resolver.setL2Registry(node, targetChainId, registry)
      const setReceipt = await setTx.wait()

      alert(`Account registered successfully!\nTransaction hash: ${tx.hash}\nNode: ${node}\nRegistry: ${registry}`)
    } catch (err: any) {
      console.error("Registration error:", err)
      let msg = "Failed to register account"
      if (err?.code === 4001) msg = "User rejected the transaction"
      else if (err?.code === -32603) msg = "Transaction failed. Please check your gas and try again."
      else if (err?.message) msg = err.message
      alert(`Registration failed: ${msg}`)
    } finally {
      setIsRegistering(false)
    }
  }

  // Frontend-triggered deployment of L2Registrar(registry)
  const deployL2Registrar = async () => {
    try {
      if (!isConnected) throw new Error("Connect wallet first")
      // Prefer registry extracted from logs, fallback to env L2 registry
      const registryForConstructor = lastRegistry || process.env.NEXT_PUBLIC_L2_REGISTRY
      if (!registryForConstructor) throw new Error("Missing registry address for constructor")

      const bytecode = process.env.NEXT_PUBLIC_L2_REGISTRAR_BYTECODE
      if (!bytecode || !bytecode.startsWith("0x")) throw new Error("Missing or invalid NEXT_PUBLIC_L2_REGISTRAR_BYTECODE")

      const abi = [
        "constructor(address _registry)",
        "event NameRegistered(string indexed label, address indexed owner)",
        "function register(string label, address owner)",
        "function available(string label) view returns (bool)",
        "function registry() view returns (address)",
        "function chainId() view returns (uint256)",
        "function coinType() view returns (uint256)",
      ]

      // Ensure we are on Base Sepolia to deploy
      await switchToBaseSepolia()

      const provider = new ethers.BrowserProvider(window.ethereum!)
      const signer = await provider.getSigner()
      const factory = new ethers.ContractFactory(abi, bytecode, signer)
      const contract = await factory.deploy(registryForConstructor)
      await contract.waitForDeployment()
      const deployedAddress = await contract.getAddress()
      setLastDeployedRegistrar(deployedAddress)
      alert(`L2Registrar deployed at: ${deployedAddress}`)
    } catch (e: any) {
      alert(`Deploy L2Registrar failed: ${e?.message || String(e)}`)
    }
  }

  // Call addRegistrar(address) on the extracted registry using the deployed registrar address
  const addRegistrarToRegistry = async () => {
    try {
      if (!isConnected) throw new Error("Connect wallet first")
      // Ensure on Base Sepolia
      await switchToBaseSepolia()

      const registryAddress = lastRegistry || process.env.NEXT_PUBLIC_L2_REGISTRY
      if (!registryAddress) throw new Error("Missing registry address (from logs or env)")
      const registrarAddress = lastDeployedRegistrar
      if (!registrarAddress) throw new Error("Missing deployed registrar address. Deploy it first.")

      const abi = [
        "function addRegistrar(address registrar) external",
      ]
      const provider = new ethers.BrowserProvider(window.ethereum!)
      const signer = await provider.getSigner()
      const registryContract = new ethers.Contract(registryAddress, abi, signer)
      const tx = await registryContract.addRegistrar(registrarAddress)
      await tx.wait()
      alert(`addRegistrar() called successfully on ${registryAddress} with registrar ${registrarAddress}`)
    } catch (e: any) {
      alert(`addRegistrar failed: ${e?.message || String(e)}`)
    }
  }

  // Call L2Registrar.register(string label, address owner)
  const registerOnL2Registrar = async () => {
    try {
      if (!isConnected || !address) throw new Error("Connect wallet first")
      if (!lastDeployedRegistrar) throw new Error("Missing deployed registrar address. Deploy it first.")
      const label = labelInput.trim()
      if (!label) throw new Error("Enter a label to register")

      // Ensure on Base Sepolia
      await switchToBaseSepolia()

      setIsRegisteringLabel(true)
      const abi = [
        "function register(string label, address owner)",
        "event NameRegistered(string indexed label, address indexed owner)",
      ]
      const provider = new ethers.BrowserProvider(window.ethereum!)
      const signer = await provider.getSigner()
      const registrar = new ethers.Contract(lastDeployedRegistrar, abi, signer)
      const tx = await registrar.register(label, address)
      const receipt = await tx.wait()
      alert(`Registered label: ${label}\nOwner: ${address}\nTx: ${tx.hash}`)
    } catch (e: any) {
      alert(`Register failed: ${e?.message || String(e)}`)
    } finally {
      setIsRegisteringLabel(false)
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
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-semibold">Register Your Account</CardTitle>
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
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            <Globe className="w-3 h-3 mr-1" />
                            Found
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-500 border-red-500">Not Found</Badge>
                        )}
                      </div>
                      {hasENS ? (
                        <div className="space-y-2">
                          <p className="font-semibold text-primary">{ensName}</p>
                          <p className="text-xs text-muted-foreground">✓ ENS domain found - you can register</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">No ENS domain found for this address.</p>
                          <Alert className="bg-red-500/10 border-red-500/20">
                            <Lock className="h-4 w-4 text-red-500" />
                            <AlertDescription className="text-red-700 dark:text-red-300">You must own an ENS domain to register an account. Please acquire an ENS domain first.</AlertDescription>
                          </Alert>
                        </div>
                      )}
                    </div>

                    <Button onClick={handleRegisterAccount} disabled={isRegistering || !hasENS} className={`w-full text-primary-foreground ${hasENS ? "bg-primary hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed"}`} size="lg">
                      {isRegistering ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Register on Base, then switch to Sepolia...
                        </>
                      ) : hasENS ? (
                        "Register on Base & Switch to Sepolia"
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          ENS Domain Required
                        </>
                      )}
                    </Button>

                    {/* Optional: Deploy L2Registrar from frontend */}
                    <Button onClick={deployL2Registrar} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" size="lg">
                      Deploy L2Registrar (constructor: registry)
                    </Button>

                    {/* Add registrar to registry */}
                    <Button onClick={addRegistrarToRegistry} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" size="lg">
                      Add Registrar to Registry
                    </Button>

                    {/* Register a label on L2 Registrar */}
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter label (e.g., blocktrain-test)"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                      />
                      <Button
                        onClick={registerOnL2Registrar}
                        disabled={!lastDeployedRegistrar || !labelInput.trim() || isRegisteringLabel}
                        className="w-full bg-primary/80 hover:bg-primary text-primary-foreground"
                        size="lg"
                      >
                        {isRegisteringLabel ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Registering label on L2 Registrar...
                          </>
                        ) : (
                          "Register Label on L2 Registrar"
                        )}
                      </Button>
                    </div>
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
    </div>
  )
}
