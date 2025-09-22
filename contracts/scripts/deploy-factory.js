const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying UserDeviceManagerFactory...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Get the contract factory
  const UserDeviceManagerFactory = await ethers.getContractFactory("UserDeviceManagerFactory");

  // Deploy the factory contract
  // You'll need to provide these parameters:
  // - uniqueId: Address of the IUniqueId contract (deploy MockUniqueId first)
  // - registry: Address of the L2Registry contract (deploy ENS Registry first)
  // - owner: Address of the factory owner

  // First, deploy MockUniqueId if not already deployed
  console.log("Deploying MockUniqueId first...");
  const MockUniqueId = await ethers.getContractFactory("MockUniqueId");
  const mockUniqueId = await MockUniqueId.deploy();
  await mockUniqueId.waitForDeployment();
  const uniqueIdAddress = await mockUniqueId.getAddress();
  console.log("MockUniqueId deployed to:", uniqueIdAddress);

  // Deploy ENS Registry
  console.log("Deploying ENS Registry...");
  const ENSRegistry = await ethers.getContractFactory("@ensdomains/ens/contracts/ENSRegistry.sol:ENSRegistry");
  const ensRegistry = await ENSRegistry.deploy();
  await ensRegistry.waitForDeployment();
  const registryAddress = await ensRegistry.getAddress();
  console.log("ENS Registry deployed to:", registryAddress);

  // Deploy the factory
  const factory = await UserDeviceManagerFactory.deploy(
    uniqueIdAddress,
    registryAddress,
    deployer.address // Owner is the deployer
  );

  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("UserDeviceManagerFactory deployed to:", factoryAddress);

  // Save deployment info
  const deploymentInfo = {
    factory: factoryAddress,
    mockUniqueId: uniqueIdAddress,
    ensRegistry: registryAddress,
    owner: deployer.address,
    deployedAt: new Date().toISOString(),
    note: "MockUniqueId is used for testing. Replace with actual UniqueId contract in production."
  };

  console.log("Deployment info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
