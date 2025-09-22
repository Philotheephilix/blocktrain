const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting complete deployment process...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Step 1: Deploy ENS Registry
  console.log("\n📦 Step 1: Deploying ENS Registry...");
  const ENSRegistry = await ethers.getContractFactory("@ensdomains/ens/contracts/ENSRegistry.sol:ENSRegistry");
  const ensRegistry = await ENSRegistry.deploy();
  await ensRegistry.waitForDeployment();
  const ensRegistryAddress = await ensRegistry.getAddress();
  console.log("✅ ENS Registry deployed to:", ensRegistryAddress);

  // Step 2: Deploy MockUniqueId
  console.log("\n📦 Step 2: Deploying MockUniqueId...");
  const MockUniqueId = await ethers.getContractFactory("MockUniqueId");
  const mockUniqueId = await MockUniqueId.deploy();
  await mockUniqueId.waitForDeployment();
  const mockUniqueIdAddress = await mockUniqueId.getAddress();
  console.log("✅ MockUniqueId deployed to:", mockUniqueIdAddress);

  // Step 3: Deploy UserDeviceManagerFactory
  console.log("\n🏭 Step 3: Deploying UserDeviceManagerFactory...");
  const UserDeviceManagerFactory = await ethers.getContractFactory("UserDeviceManagerFactory");
  
  const factory = await UserDeviceManagerFactory.deploy(
    mockUniqueIdAddress,
    ensRegistryAddress, // Use the deployed ENS Registry
    deployer.address // Owner is the deployer
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ UserDeviceManagerFactory deployed to:", factoryAddress);

  // Step 4: Deploy a sample user contract
  console.log("\n👤 Step 4: Deploying sample user contract...");
  
  const userAddress = deployer.address;
  const ensDomain = "testuser.ens";
  const userNullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-nullifier"));
  
  const tx = await factory.deployUserDeviceManager(
    userAddress,
    ensDomain,
    userNullifierHash
  );
  const receipt = await tx.wait();
  
  // Get the deployed contract address from the event
  const event = receipt.logs.find(log => {
    try {
      const parsed = factory.interface.parseLog(log);
      return parsed.name === "UserDeviceManagerDeployed";
    } catch (e) {
      return false;
    }
  });

  let userContractAddress = null;
  if (event) {
    const parsed = factory.interface.parseLog(event);
    userContractAddress = parsed.args.contractAddress;
    console.log("✅ User Device Manager deployed to:", userContractAddress);
  } else {
    console.log("❌ Could not find deployment event");
  }

  // Step 5: Test the deployed contracts
  console.log("\n🧪 Step 5: Testing deployed contracts...");
  
  // Test ENS Registry
  try {
    const owner = await ensRegistry.owner(ethers.ZeroHash);
    console.log("✅ ENS Registry test passed");
    console.log("   - Root owner:", owner);
  } catch (error) {
    console.log("❌ ENS Registry test failed:", error.message);
  }

  // Test MockUniqueId
  try {
    await mockUniqueId.verifyProof(
      1, // root
      1, // groupId
      1, // signalHash
      1, // nullifierHash
      1, // externalNullifierHash
      [1, 2, 3, 4, 5, 6, 7, 8] // proof
    );
    console.log("✅ MockUniqueId verification test passed");
  } catch (error) {
    console.log("❌ MockUniqueId verification test failed:", error.message);
  }

  // Test Factory functions
  try {
    const hasContract = await factory.hasUserContract(userAddress);
    const userContract = await factory.getUserContract(userAddress);
    console.log("✅ Factory lookup test passed");
    console.log("   - Has user contract:", hasContract);
    console.log("   - User contract address:", userContract);
  } catch (error) {
    console.log("❌ Factory lookup test failed:", error.message);
  }

  // Test User Device Manager
  if (userContractAddress) {
    try {
      const userContract = await ethers.getContractAt("UserDeviceManager", userContractAddress);
      const ensDomainFromContract = await userContract.ensDomain();
      const userAddressFromContract = await userContract.userAddress();
      const deviceCount = await userContract.getDeviceCount();
      
      console.log("✅ User Device Manager test passed");
      console.log("   - ENS Domain:", ensDomainFromContract);
      console.log("   - User Address:", userAddressFromContract);
      console.log("   - Device Count:", deviceCount.toString());
    } catch (error) {
      console.log("❌ User Device Manager test failed:", error.message);
    }
  }

  // Final deployment summary
  console.log("\n📋 Deployment Summary:");
  console.log("=====================");
  console.log("ENS Registry:", ensRegistryAddress);
  console.log("MockUniqueId:", mockUniqueIdAddress);
  console.log("Factory:", factoryAddress);
  console.log("User Contract:", userContractAddress || "Not deployed");
  console.log("Deployer:", deployer.address);
  
  const deploymentInfo = {
    ensRegistry: ensRegistryAddress,
    mockUniqueId: mockUniqueIdAddress,
    factory: factoryAddress,
    userContract: userContractAddress,
    deployer: deployer.address,
    ensDomain: ensDomain,
    userNullifierHash: userNullifierHash,
    deployedAt: new Date().toISOString(),
    note: "MockUniqueId is used for testing. Replace with actual UniqueId contract in production."
  };

  console.log("\n📄 Full deployment info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
