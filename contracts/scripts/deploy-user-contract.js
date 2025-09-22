const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying User Device Manager through Factory...");

  // Get the factory contract
  const factoryAddress = "0x..."; // Replace with actual factory address
  const factory = await ethers.getContractAt("UserDeviceManagerFactory", factoryAddress);

  // User parameters
  const userAddress = "0x..."; // Replace with user's address
  const ensDomain = "user.ens"; // Replace with user's ENS domain
  const userNullifierHash = "0x..."; // Replace with user's nullifier hash

  console.log("Deploying contract for user:", userAddress);
  console.log("ENS Domain:", ensDomain);

  // Deploy the user contract through the factory
  const tx = await factory.deployUserDeviceManager(
    userAddress,
    ensDomain,
    userNullifierHash
  );

  const receipt = await tx.wait();
  console.log("Transaction hash:", tx.hash);

  // Get the deployed contract address from the event
  const event = receipt.logs.find(log => {
    try {
      const parsed = factory.interface.parseLog(log);
      return parsed.name === "UserDeviceManagerDeployed";
    } catch (e) {
      return false;
    }
  });

  if (event) {
    const parsed = factory.interface.parseLog(event);
    const contractAddress = parsed.args.contractAddress;
    console.log("User Device Manager deployed to:", contractAddress);
    
    // Verify the deployment
    const userContract = await ethers.getContractAt("UserDeviceManager", contractAddress);
    const deployedUserAddress = await userContract.userAddress();
    const deployedEnsDomain = await userContract.ensDomain();
    
    console.log("Verification:");
    console.log("- User Address:", deployedUserAddress);
    console.log("- ENS Domain:", deployedEnsDomain);
    console.log("- Matches:", deployedUserAddress === userAddress && deployedEnsDomain === ensDomain);
  } else {
    console.log("Could not find deployment event");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
