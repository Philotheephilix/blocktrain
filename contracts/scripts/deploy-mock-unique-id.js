const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying MockUniqueId...");

  // Get the contract factory
  const MockUniqueId = await ethers.getContractFactory("MockUniqueId");

  // Deploy the mock contract
  const mockUniqueId = await MockUniqueId.deploy();

  await mockUniqueId.waitForDeployment();

  const mockUniqueIdAddress = await mockUniqueId.getAddress();
  console.log("MockUniqueId deployed to:", mockUniqueIdAddress);

  // Save deployment info
  const deploymentInfo = {
    mockUniqueId: mockUniqueIdAddress,
    deployedAt: new Date().toISOString(),
    note: "This is a mock implementation for testing. Replace with actual UniqueId contract in production."
  };

  console.log("Deployment info:", JSON.stringify(deploymentInfo, null, 2));
  
  // Test the contract
  console.log("\nTesting MockUniqueId...");
  
  // Test with valid parameters
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
