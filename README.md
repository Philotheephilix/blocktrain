# Flash

A privacy-first identity framework where devices prove who you are, and your data never leaves your control. Blocktrain combines ENS-based device identities, zero-knowledge proofs, and a user-owned Personal Data Vault (PDV) to let apps verify what they need without ever seeing your raw data.

## Why Blocktrain?
- **User-owned identity**: One ENS name per user (e.g., `alice.eth`), with cryptographically verifiable device subdomains such as `phone.alice.eth`.
- **Privacy by default**: Apps receive zero-knowledge proofs of facts (e.g., “over 21”, “has an active subscription”) instead of raw data.
- **User-owned data**: Sensitive data (interests, ad IDs, credentials) is encrypted in a PDV on decentralized storage; only the user can unlock it.
- **Developer-friendly**: Clean separation of concerns between identity (on-chain), proofs (off-chain/on-chain verification), and consented data access.

## Core Flow (Alice’s Journey)
1. **One ENS identity**: Alice starts with `alice.eth`.
2. **Device subdomains**: Each device gets a secure subdomain like `phone.alice.eth`, minted via a registrar contract for tamper-resistant, cryptographically verifiable binding.
3. **ZK-based interactions**: When apps need to know something about Alice, she provides zero-knowledge proofs confirming facts (e.g., age > 21, active subscription) without revealing underlying personal data.
4. **Encrypted PDV**: Alice’s real data (interests, Ad ID, credentials) lives encrypted in her Personal Data Vault on decentralized storage. Only she can decrypt it.
5. **Consent-scoped access**: Apps can only use specific data she approves, and only for the scopes she authorizes.
6. **Outcome**: The device is always verified as Alice’s, but the data never leaves her control. Apps can’t track her, developers can’t sell her info, and third parties can’t assemble shadow profiles.

## Architecture Overview
- **Smart Contracts (`contracts/`)**
  - ENS-based device identity via a registrar and resolvers (e.g., `L2Registrar.sol`, `UserDeviceManager.sol`, `DAIDENSResolver.sol`).
  - Interfaces and helpers for registration, resolution, and per-device management.
  - Hardhat project for compilation, testing, and deployment scripts (see `contracts/scripts/`).
- **Web App (`blocktrain/blocktrain/`)**
  - Next.js (App Router) frontend that integrates with ENS utilities and APIs.
  - Example ENS endpoint in `app/api/ens/route.ts` and helpers in `lib/ens-utils.ts`.
  - Tailwind + shadcn/ui-based components for building app experiences.
- **Personal Data Vault (PDV)**
  - User-encrypted data stored on decentralized storage (e.g., IPFS/Filecoin or compatible networks). Only the user’s keys unlock it.
  - Apps gain access only through explicit, time- and scope-limited consent.
- **Zero-Knowledge Proofs (ZK)**
  - Proofs are generated on the user’s device (or trusted client environment) and verified either on-chain or by the app backend, depending on the protocol.

## Repository Layout
- `contracts/` — Solidity contracts, Hardhat config, and deployment scripts
- `blocktrain/blocktrain/` — Next.js web app (frontend + API routes)
- `blocktrain/public/` — Static assets used by the web app

## Quickstart

### Prerequisites
- Node.js 18+
- pnpm (recommended), or npm/yarn

### Run the Web App
```bash
# From repo root
cd blocktrain/blocktrain
pnpm install
pnpm dev
# App runs at http://localhost:3000
```

### Work with Contracts
```bash
# From repo root
cd contracts
pnpm install
pnpm hardhat compile

# Start a local chain in one terminal
yarn hardhat node
# or
npx hardhat node

# In another terminal, deploy sample contracts
npx hardhat run scripts/deploy-all.js --network localhost
```

If you deploy to a testnet or your local node, surface any required contract addresses to the web app (via environment variables or a small config layer) so the frontend can resolve ENS and registrar interactions.

## How It Fits Together (Conceptual)
- **Identity**: ENS name per user; registrar mints device subdomains to bind devices to the user.
- **Authentication**: Apps verify device ownership via the ENS-derived subdomain and signatures.
- **Authorization**: Users consent to share only what’s needed; proofs attest to facts without exposing data.
- **Data**: PDV holds raw data encrypted with user keys; apps access derived signals, not the raw content.

## Status and Roadmap
- Active development. Expect interfaces to evolve as ZK circuits, PDV providers, and registrars are integrated end-to-end.
- Looking for feedback on developer ergonomics, consent UX, and reference circuits.