const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

function getArg(flag) {
  const match = process.argv.find((a) => a.startsWith(`${flag}=`))
  return match ? match.split("=")[1] : undefined
}

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  const network = hre.network.name

  // Get registry address: --registry=0x... or ENV (REGISTRY or L2_REGISTRY or NEXT_PUBLIC_L2_REGISTRY)
  const fromCli = getArg("--registry")
  const registry = fromCli || process.env.REGISTRY || process.env.L2_REGISTRY || process.env.NEXT_PUBLIC_L2_REGISTRY
  if (!registry) {
    throw new Error("Missing registry address. Pass --registry=0x... or set REGISTRY/L2_REGISTRY/NEXT_PUBLIC_L2_REGISTRY env var.")
  }
  if (!hre.ethers.isAddress(registry)) {
    throw new Error(`Invalid registry address: ${registry}`)
  }

  console.log("Deploying L2Registrar with:")
  console.log("- Deployer:", deployer.address)
  console.log("- Network:", network)
  console.log("- Registry:", registry)

  const L2Registrar = await hre.ethers.getContractFactory("L2Registrar")
  const registrar = await L2Registrar.deploy(registry)
  await registrar.waitForDeployment()
  const registrarAddress = await registrar.getAddress()

  console.log("L2Registrar deployed to:", registrarAddress)

  // Save deployment artifact
  const deployment = {
    network,
    contract: "L2Registrar",
    address: registrarAddress,
    constructorArgs: [registry],
    deployer: deployer.address,
    txHash: registrar.deploymentTransaction()?.hash || null,
    timestamp: new Date().toISOString(),
  }

  const outDir = path.join(__dirname, "../deployments")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)
  const outFile = path.join(outDir, `l2-registrar-${network}.json`)
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2))
  console.log("Saved deployment →", outFile)

  // Optional: wait a couple confirmations for explorers
  const deployTx = registrar.deploymentTransaction()
  if (deployTx && deployTx.wait) {
    try { await deployTx.wait(2) } catch (_) {}
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
}) 