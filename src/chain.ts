import { createConfig, http as wagmiHttp } from 'wagmi'
import { injected } from 'wagmi/connectors/injected'
import { coinbaseWallet } from 'wagmi/connectors/coinbaseWallet'
import { createPublicClient, fallback, http, parseAbi } from 'viem'
import { sepolia } from 'viem/chains'

export const CONTRACTS = {
  core: '0x980b4424c007caf7a1f3670b48c8eaef7ebc3d44',
  token: '0x5501e1fa81be1c3f49225fa7668da0245d07db60',
  nft: '0xcb98349c134ab983da5bfd80527dfe2552bdb70f',
  mining: '0xcd46990f8349057335289ef282c276204b6cdc62',
  staking: '0x4b67b739dfd832f4eac67a7aa3bc244fb74cea4f',
} as const
export const API = 'https://api.squeekchain.com/v1'
export const RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
export const EXPLORER = 'https://sepolia.etherscan.io'
export const DEPLOYMENT_BLOCK = 11998937n
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: fallback([
    http(RPC, { timeout: 12_000, retryCount: 1, batch: { wait: 30, batchSize: 50 } }),
    http('https://sepolia.drpc.org', { timeout: 12_000, retryCount: 1, batch: { wait: 30, batchSize: 50 } }),
  ]),
})
export const config = createConfig({
  chains: [sepolia],
  multiInjectedProviderDiscovery: true,
  connectors: [injected(), coinbaseWallet({ appName: 'Squeek Keeper Console' })],
  transports: { [sepolia.id]: wagmiHttp(RPC) },
})

// Current production ABIs, extracted as data from squeekchain.com's production bundle.
// See artifacts/contracts.md for provenance and read-only onchain checks.
export const coreAbi = parseAbi([
  'function state() view returns ((uint64 settledThroughRound, uint64 cumulativeWork, uint96 cumulativeBlockUnits, uint64 blockHeight, uint96 blockProgress, uint32 workPerThousandBlocks, uint256 authorizationNonce, bool paused) result)',
])
export const miningAbi = parseAbi([
  'function checkpointStatus() view returns (bool corePaused, uint64 nextRound, bool roundSettled)',
  'function checkpoint()',
  'function core() view returns (address)',
  'function state() view returns ((uint256 minted, uint256 gachaFunded, uint256 stakingFunded, uint64 processedThroughRound, uint64 startRound, uint64 startHeight, uint64 fundedBlocks, address guardian, bool bootstrapped, bool startCaptured, bool paused, bool active))',
  'event Checkpointed(uint64 indexed throughRound, uint64 fundedBlocks, uint256 amount)',
  'error RoundNotSettled(uint64 round)',
  'error CorePaused()',
  'error MiningPaused()',
  'error CoreUnavailable()',
])
export const nftAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function level(uint256 tokenId) view returns (uint8)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
])
export const tokenAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
])
export const stakingAbi = parseAbi([
  'function accountPower(address account) view returns (uint256 nftPower, uint256 sqkPower)',
  'function claimable(address account) view returns (uint256)',
  'function claimRecipient(address account) view returns (address)',
  'function claim(address account) returns (uint256 amount)',
  'function claimAndStake() returns (uint256 amount)',
  'function deposit(address collection, uint256[] tokenIds)',
  'function depositor(address collection, uint256 tokenId) view returns (address)',
  'function stake(uint256 amount)',
  'function stakeOf(address account) view returns (uint256 principal, uint256 freshPrincipal, uint64 freshUntilRound)',
  'function paused() view returns (bool)',
  'function launchReady() view returns (bool)',
  'function MAX_TOKENS() view returns (uint256)',
  'function core() view returns (address)',
  'function token() view returns (address)',
  'function genesis() view returns (address)',
  'event Deposited(address indexed account, address indexed collection, uint256 indexed tokenId, uint8 level, uint64 basePower, uint256 power)',
  'error Unauthorized()',
  'error IntakePaused()',
  'error InvalidAmount()',
])
