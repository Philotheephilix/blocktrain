const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying WorldENSResolver with the account:", deployer.address);
  console.log(
    "Account balance:",
    (await deployer.provider.getBalance(deployer.address)).toString()
  );

  const network = hre.network.name;
  console.log(`Deploying to ${network}...`);

  const worldId = "0x17B354dD2595411ff79041f930e491A4Df39A278";
  const appId = "app_8fc33d2a1f61cc65a02c3db25559bf25";
  const actionId = "proof-of-humanity";
  const inputRegistry = "0x2565b1f8bfd174d3acb67fd1a377b8014350dc26";
  const owner = deployer.address;

  console.log({
    worldId,
    appId,
    actionId,
    inputRegistry,
    owner,
  });

  const WorldENSResolver = await hre.ethers.getContractFactory(
    "WorldENSResolver"
  );
  const worldTesting = await WorldENSResolver.deploy(
    worldId,
    appId,
    actionId,
    inputRegistry,
    owner
  );

  await worldTesting.waitForDeployment();
  const frankyAddress = await worldTesting.getAddress();

  console.log("WorldENSResolver deployed to:", frankyAddress);

  // Save deployment information
  const deploymentData = {
    network: network,
    worldTesting: frankyAddress,
    timestamp: new Date().toISOString(),
  };

  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir);
  }

  fs.writeFileSync(
    path.join(deploymentDir, `${network}-deployment.json`),
    JSON.stringify(deploymentData, null, 2)
  );

  // Verify WorldTesting contract
  console.log("Waiting for block confirmations...");
  // In ethers v6, we access the deployment transaction differently
  const deployTx = worldTesting.deploymentTransaction();
  await deployTx.wait(2);

  // Verify contract on Etherscan if not on a local network
  if (network !== "localhost" && network !== "hardhat") {
    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: frankyAddress,
        constructorArguments: [worldId, appId, actionId, inputRegistry, owner],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.log("Error verifying contract:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
