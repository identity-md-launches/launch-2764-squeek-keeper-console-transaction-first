# Squeek Keeper Console

A single-page, wallet-connected companion for Squeekchain on **Sepolia (11155111)**. The finished static site is in `dist/`; source is in `src/`. No backend, API key, relay, or WalletConnect project ID is required.

## Install, run, rebuild

Use Node.js 22.12+ (Node 24 was used for validation) and npm.

```sh
npm ci
npm run dev
```

To rebuild and preview the production export:

```sh
npm run typecheck
npm run build
npm run preview
```

Vite prints the local preview URL, normally `http://localhost:4173/`. `npm run build` replaces `dist/`. Serve **the contents of `dist/`** from any static host. Asset URLs are relative (`base: './'`), and navigation uses hash anchors, so gateway subpaths work without server rewrites. Open the export through HTTP(S), rather than `file://`.

Dependencies and package caches are not part of this delivery. Keep `dist/` in the submission alongside the source, `package.json`, and `package-lock.json`. No ignore file was created or modified.

## What works

- **Keeper:** reads `checkpointStatus()`, Core state, and Mining state at the same Sepolia block; derives pending rounds; simulates and sends `checkpoint()`. Confirmed receipts refresh the desk. A bounded checkpoint may leave additional work for another explicitly approved call.
- **Leaderboard:** scans `Checkpointed(uint64,uint64,uint256)` logs from the pinned deployment, deduplicates transaction hashes, resolves transaction senders and block times, and ranks every discovered sender. Shows the top five and an expansion for all keepers. If an RPC prunes history, it pages the official indexed contract events instead. An incomplete scan shows an error, never a partial ranking presented as complete.
- **Holder:** pages the account API, bridges the index lag with incoming NFT transfers/deposits, and verifies `ownerOf`, `depositor`, and level onchain. If the account API fails, it discovers candidates entirely from logs. Displays wallet/deposited NFTs, separate NFT/SQK power, and claimable rewards. Supports collection approval/revocation, selected deposits, rewards to the configured recipient, and `claimAndStake()`.
- **SQK:** reads balance, allowance, and staked principal; approves the exact entered amount; stakes in a separate transaction; validates 18-decimal amounts. The safe ping calls `SQK.approve(connectedWallet, 0)` and sends no tokens.
- **Wallet:** named browser-wallet discovery through EIP-6963, Coinbase Wallet / Smart Wallet, and mobile links to MetaMask, Coinbase Wallet, Rabby, and Phantom. Connection requests Sepolia; switching automatically adds the network if needed. The connected-wallet menu shows the full address and Sepolia ETH balance.
- **Wheel:** API telemetry plus onchain height/progress, refreshed every 15 seconds. Offline/stale hardware data is labeled unavailable; the chain cannot supply RPM. Account reads refresh every 30 seconds and the leaderboard every two minutes.
- **Activity:** every submitted hash is stored in this browser, including account, time, and Sepolia Etherscan link. Receipts are checked every 15 seconds, including after reload. Pending, confirmed, and reverted are distinct. Blocked local storage falls back to an in-memory log with a visible explanation.

Every action opens a review with the method, full addresses, consequences, current amounts, and an estimated gas fee. **Only “Confirm in wallet” requests a transaction**, followed by the wallet's own confirmation. The sender and network are checked again before sending. Claims also recheck the configured recipient. All contract transactions send **0 ETH value**; network gas still costs Sepolia ETH. The app never requests a private key or seed phrase.

## Contracts and data

Addresses, minimal current ABIs, network, and public RPC transports live together in [`src/chain.ts`](src/chain.ts). They are pinned to the assignment; the app does not accept replacement addresses from API responses.

| Contract | Sepolia address |
| --- | --- |
| SqueekCore | `0x980b4424c007caf7a1f3670b48c8eaef7ebc3d44` |
| SQK | `0x5501e1fa81be1c3f49225fa7668da0245d07db60` |
| Genesis Squeeks | `0xcb98349c134ab983da5bfd80527dfe2552bdb70f` |
| SqueekMining proxy | `0xcd46990f8349057335289ef282c276204b6cdc62` |
| Staking proxy | `0x4b67b739dfd832f4eac67a7aa3bc244fb74cea4f` |

Public reads use [wheel status](https://api.squeekchain.com/v1/status), [economy state](https://api.squeekchain.com/v1/economy/state), the account/event APIs, and [Sepolia PublicNode RPC](https://ethereum-sepolia-rpc.publicnode.com), with `https://sepolia.drpc.org` as the second RPC transport. No request uses credentials. Contract ABI provenance and observed live values are in [`artifacts/contracts.md`](artifacts/contracts.md).

## Validation

```sh
npx playwright install chromium
npm run validate
```

The validation script owns a temporary HTTP server, serves the production export at `/preview/`, and uses explicit EIP-6963/RPC fixtures. It never signs or broadcasts. A substring argument runs a specific group, for example `npm run validate -- "Safe ping"`. Browser binaries are tooling, not delivery assets.

Actual worker results: production build and separate TypeScript check passed; **13/13 interaction groups passed**; the pinned design probe passed **16/16** on the final export. Live, read-only API/RPC validation was also performed separately from the fixtures. See [`artifacts/validation.md`](artifacts/validation.md), the [interaction output](artifacts/interaction-results.txt), [mobile screenshot](artifacts/screenshots/mobile.png), and [desktop screenshot](artifacts/screenshots/desktop.png).

Real wallet signatures/broadcasts, physical mobile-app handoffs, Coinbase passkey onboarding, and a screen-reader session were not performed. WebKit was attempted but could not launch because its required system libraries are unavailable. Mocked wallet checks establish call construction and confirmation boundaries, not an independently verified onchain write. Public RPC availability remains an external dependency; a full history scan may be slow, and the indexed fallback caps pagination at 200 pages. Relayed checkpoint transactions are attributed to the transaction sender, which may be a relayer. Dropped/replaced transaction hashes remain pending with an explanation and explorer link.

The implemented visual system is documented in [`DESIGN.md`](DESIGN.md); credits and licenses are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
