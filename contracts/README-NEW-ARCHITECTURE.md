# User Device Manager Architecture

This document describes the new architecture for managing user devices and app permissions using ENS subdomains and zero-knowledge proofs.

## Overview

The new architecture consists of four main contracts:

1. **ENSRegistry** - Standard ENS Registry contract for domain management
2. **MockUniqueId** - Mock implementation of IUniqueId for testing (replace with actual implementation in production)
3. **UserDeviceManagerFactory** - Factory contract for deploying user-specific contracts
4. **UserDeviceManager** - User-specific contract for managing devices and app permissions

## Architecture Flow

### 1. ENS Registry Deployment
- Deploy the standard `ENSRegistry` contract from @ensdomains/ens
- This provides the core ENS functionality for domain management
- **Production Ready**: This is the actual ENS Registry contract

### 2. MockUniqueId Deployment
- Deploy the `MockUniqueId` contract (for testing purposes)
- This implements the `IUniqueId` interface for ZK proof verification
- **In production**: Replace with actual UniqueId contract implementation

### 3. Factory Deployment
- Deploy the `UserDeviceManagerFactory` contract
- The factory manages all user contracts and provides lookup functions
- **No app ID or action ID required** - simplified deployment

### 4. User Registration
- Each user gets their own `UserDeviceManager` contract deployed through the factory
- The constructor takes:
  - User's address
  - User's ENS domain name
  - User's nullifier hash (for authentication)

### 5. Device Management
- Users can add devices by calling `addDevice()` with:
  - Device model name
  - Device address
  - Device nullifier hash
  - ZK proof for verification
- Each device gets a subdomain: `model.ens.eth`
- Device hash is created using: `keccak256(subdomain + deviceAddress + deviceNullifier)`
- **Each device maintains a list of apps** referenced by app ID

### 6. App Permission Management
- Users can add apps to devices with `addAppToDevice()`
- Each app has a permission level: 0, 1, 2, or 3
- Users can update permissions with `updateAppPermission()`
- Only the user (owner) can modify app permissions
- **Each device has a complete list of app IDs** for enumeration

## Contract Details

### ENSRegistry

**Purpose**: Standard ENS Registry contract for domain management
**Source**: @ensdomains/ens/contracts/ENSRegistry.sol
**Functions**:
- `owner(bytes32 node)` - Get owner of a domain node
- `setOwner(bytes32 node, address owner)` - Set owner of a domain node
- `setSubnodeOwner(bytes32 node, bytes32 label, address owner)` - Create subdomain
- `resolver(bytes32 node)` - Get resolver for a domain
- `setResolver(bytes32 node, address resolver)` - Set resolver for a domain

### MockUniqueId

**Purpose**: Mock implementation of IUniqueId interface for testing
**Functions**:
- `verifyProof()` - Mock ZK proof verification (always passes with valid inputs)

**Note**: Replace with actual UniqueId contract in production

### UserDeviceManagerFactory

**Constructor Parameters:**
- `uniqueId`: Address of the IUniqueId contract (MockUniqueId for testing)
- `registry`: Address of the ENS Registry contract
- `owner`: Address of the factory owner

**Key Functions:**
- `deployUserDeviceManager()` - Deploy a new user contract
- `getUserContract(address)` - Get user's contract address
- `getContractByDomain(string)` - Get contract by ENS domain
- `hasUserContract(address)` - Check if user has a contract
- `isDomainRegistered(string)` - Check if domain is registered

**Events:**
- `UserDeviceManagerDeployed` - Emitted when a new user contract is deployed

### UserDeviceManager

**Constructor Parameters:**
- `uniqueId`: Address of the IUniqueId contract
- `registry`: Address of the ENS Registry contract
- `userAddress`: The user's address
- `ensDomain`: The user's ENS domain name
- `userNullifierHash`: The user's nullifier hash

**Key Functions:**
- `addDevice()` - Add a new device with ZK proof verification
- `addAppToDevice()` - Add an app to a device with permission
- `updateAppPermission()` - Update app permission for a device
- `getDevice()` - Get device information
- `getAppPermission()` - Get app permission for a device
- `getDeviceAppIds()` - Get all app IDs for a device
- `getDeviceAppCount()` - Get app count for a device
- `getAllDeviceHashes()` - Get all device hashes
- `getDeviceCount()` - Get total device count

**Events:**
- `DeviceAdded` - Emitted when a device is added
- `AppAdded` - Emitted when an app is added to a device
- `AppPermissionUpdated` - Emitted when app permission is updated

## Data Structures

### Device
```solidity
struct Device {
    string model;           // Device model name
    string subdomain;       // ENS subdomain (e.g., "model.ens.eth")
    address deviceAddress;  // Device's address
    uint256 deviceNullifier; // Device's nullifier hash
    bool exists;           // Whether device exists
}
```

### AppPermission
```solidity
struct AppPermission {
    uint8 permission;      // Permission level (0/1/2/3)
    bool exists;          // Whether app exists
}
```

## Device App Management

Each device maintains:
1. **App Permission Mapping**: `deviceHash → appId → AppPermission`
2. **App ID List**: `deviceHash → string[]` for enumeration
3. **App Count**: Easy access to number of apps per device

### App List Functions:
- `getDeviceAppIds(deviceHash)` - Returns array of all app IDs for a device
- `getDeviceAppCount(deviceHash)` - Returns number of apps on a device
- `getAppPermission(deviceHash, appId)` - Returns permission for specific app

## Permission Levels

- **0**: No access
- **1**: Read-only access
- **2**: Read and write access
- **3**: Full access (read, write, delete)

## Security Features

1. **Zero-Knowledge Proofs**: Device addition requires ZK proof verification
2. **Nullifier Hash**: Prevents double-spending and ensures uniqueness
3. **User Ownership**: Only the user can modify their devices and app permissions
4. **ENS Integration**: Each device gets a unique ENS subdomain
5. **Factory Pattern**: Centralized management of user contracts
6. **Simplified Deployment**: No app ID or action ID required
7. **Standard ENS**: Uses official ENS Registry contract

## Deployment Process

### Option 1: Deploy All Contracts (Recommended for Testing)
```bash
npx hardhat run scripts/deploy-all.js --network <network>
```

This script will:
1. Deploy ENS Registry
2. Deploy MockUniqueId
3. Deploy UserDeviceManagerFactory
4. Deploy a sample user contract
5. Run comprehensive tests

### Option 2: Deploy Individual Contracts

#### 1. Deploy ENS Registry
```bash
npx hardhat run scripts/deploy-ens-registry.js --network <network>
```

#### 2. Deploy MockUniqueId
```bash
npx hardhat run scripts/deploy-mock-unique-id.js --network <network>
```

#### 3. Deploy Factory
```bash
npx hardhat run scripts/deploy-factory.js --network <network>
```

**Factory Constructor:**
```javascript
const factory = await UserDeviceManagerFactory.deploy(
  uniqueId,    // MockUniqueId contract address
  registry,    // ENS Registry contract address
  owner        // Factory owner address
);
```

#### 4. Deploy User Contract
```bash
npx hardhat run scripts/deploy-user-contract.js --network <network>
```

**User Contract Deployment:**
```javascript
const tx = await factory.deployUserDeviceManager(
  userAddress,        // User's address
  ensDomain,          // User's ENS domain
  userNullifierHash   // User's nullifier hash
);
```

## Usage Examples

### Adding a Device
```solidity
// User calls their contract to add a device
userContract.addDevice(
    "iPhone15",           // model
    deviceAddress,        // device address
    deviceNullifier,      // device nullifier hash
    root,                 // merkle root
    nullifierHash,        // proof nullifier hash
    proof                 // ZK proof
);
```

### Adding an App to Device
```solidity
// User adds an app to a device
userContract.addAppToDevice(
    deviceHash,           // device hash
    "com.example.app",    // app ID
    2                     // permission level (read/write)
);
```

### Getting Device App List
```solidity
// Get all app IDs for a device
string[] memory appIds = userContract.getDeviceAppIds(deviceHash);

// Get app count for a device
uint256 appCount = userContract.getDeviceAppCount(deviceHash);

// Get specific app permission
AppPermission memory permission = userContract.getAppPermission(deviceHash, "com.example.app");
```

### Updating App Permission
```solidity
// User updates app permission
userContract.updateAppPermission(
    deviceHash,           // device hash
    "com.example.app",    // app ID
    3                     // new permission level (full access)
);
```

## Production Considerations

### Replace MockUniqueId
In production, replace the `MockUniqueId` contract with the actual UniqueId implementation that:
- Implements proper ZK proof verification
- Connects to the actual Semaphore network
- Handles real nullifier verification

### ENS Registry
The ENS Registry is already production-ready as it's the official ENS contract from @ensdomains/ens.

### Security Audit
Before production deployment:
- Audit the ZK proof verification logic
- Review the nullifier hash handling
- Test the ENS integration thoroughly
- Verify access control mechanisms

## Benefits

1. **Scalability**: Each user has their own contract, preventing state bloat
2. **Privacy**: User data is isolated in their own contract
3. **Flexibility**: Easy to add new features per user
4. **ENS Integration**: Human-readable device identification using standard ENS
5. **ZK Proofs**: Privacy-preserving device verification
6. **Permission Management**: Granular app permissions per device
7. **App Enumeration**: Complete list of apps per device
8. **Simplified Deployment**: No complex app/action ID management
9. **Testing Ready**: MockUniqueId allows for easy testing
10. **Production Ready**: Uses official ENS Registry contract

## Key Changes from Previous Version

1. **Added ENS Registry**: Official ENS Registry contract for domain management
2. **Added MockUniqueId**: Mock implementation for testing ZK proof verification
3. **Removed App ID and Action ID** from factory constructor
4. **Added Device App Lists** - Each device maintains a complete list of app IDs
5. **Enhanced App Management** - Better enumeration and counting functions
6. **Simplified Deployment** - Fewer parameters required for factory deployment
7. **Improved Interface** - Added functions for app list management
8. **Complete Deployment Script** - One script deploys everything for testing
9. **Production Ready ENS**: Uses official ENS contracts instead of mock addresses

## Migration from DAIDENSResolver

The new architecture replaces the single `DAIDENSResolver` contract with:
- Official ENS Registry for domain management
- A mock UniqueId implementation for testing
- A factory for managing user contracts (simplified deployment)
- Individual user contracts for device management
- Enhanced device and app permission management
- Complete app enumeration per device
- Better scalability and privacy

This architecture is designed to handle multiple users efficiently while maintaining security and privacy through zero-knowledge proofs and standard ENS integration.
