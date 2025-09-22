const { ethers } = require("hardhat");

async function main() {
  console.log("🌐 Deploying ENS Registry...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy ENS Registry
  console.log("\n📦 Deploying ENS Registry...");
  const ENSRegistry = await ethers.getContractFactory("@ensdomains/ens/contracts/ENSRegistry.sol:ENSRegistry");
  const ensRegistry = await ENSRegistry.deploy();
  await ensRegistry.waitForDeployment();
  const ensRegistryAddress = await ensRegistry.getAddress();
  console.log("✅ ENS Registry deployed to:", ensRegistryAddress);

  // Test the deployed registry
  console.log("\n🧪 Testing ENS Registry...");
  try {
    const owner = await ensRegistry.owner(ethers.ZeroHash);
    console.log("✅ ENS Registry test passed");
    console.log("   - Root owner:", owner);
    console.log("   - Registry address:", ensRegistryAddress);
  } catch (error) {
    console.log("❌ ENS Registry test failed:", error.message);
  }

  // Save deployment info
  const deploymentInfo = {
    ensRegistry: ensRegistryAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    note: "This is the main ENS Registry contract. Use this address in other deployment scripts."
  };

  console.log("\n📄 Deployment info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
