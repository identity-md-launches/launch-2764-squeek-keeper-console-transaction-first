import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { type Address, type Hex, type Log, getAddress, parseAbiItem, zeroAddress } from 'viem'
import { API, CONTRACTS, coreAbi, DEPLOYMENT_BLOCK, miningAbi, nftAbi, publicClient, stakingAbi, tokenAbi } from './chain'

export type WheelStatus = {
  generatedAt: string
  measurement: { freshness: string; observedAt: string; staleAfterSeconds: number; coreStatus: string; rpmMilli: number; speedMmPerSecond: number }
  builder?: { anchor?: { blockHeight: string; blockProgress: string } }
}
export type Economy = {
  status: string; generatedAt: string
  chain: { chainId: string; deploymentBlock: string; indexedThroughBlock: string }
  identities: { core: string; token: string; genesis: string; mining: { proxy: string }; staking: { proxy: string } }
  mining: { processedThroughRound: string }
  staking: { totalStakedBaseUnits: string }
}

export async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(12_000), headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`API returned ${response.status}. Retry the read.`)
  return response.json() as Promise<T>
}

export async function readChain() {
  const readAt = Date.now()
  const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 })
  const [core, checkpoint, mining, paused, ready] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.core, abi: coreAbi, functionName: 'state', blockNumber }),
    publicClient.readContract({ address: CONTRACTS.mining, abi: miningAbi, functionName: 'checkpointStatus', blockNumber }),
    publicClient.readContract({ address: CONTRACTS.mining, abi: miningAbi, functionName: 'state', blockNumber }),
    publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'paused', blockNumber }),
    publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'launchReady', blockNumber }),
  ])
  const [corePaused, nextRound, roundSettled] = checkpoint
  const pending = roundSettled && core.settledThroughRound >= nextRound ? core.settledThroughRound - nextRound + 1n : 0n
  return { core, mining, corePaused, nextRound, roundSettled, pending, stakingPaused: paused, ready, blockNumber, readAt }
}

export function useLiveData() {
  const status = useQuery({ queryKey: ['wheel'], queryFn: async () => {
    const value = await fetchApi<WheelStatus>('/status')
    if (!value.measurement || !value.measurement.observedAt) throw new Error('Wheel telemetry is unavailable.')
    return value
  }, refetchInterval: 15_000 })
  const economy = useQuery({ queryKey: ['economy'], queryFn: async () => {
    const value = await fetchApi<Economy>('/economy/state')
    if (value.status !== 'available' || !value.identities) throw new Error('Economy index is unavailable. Direct contract reads remain active.')
    const ids = value.identities
    if (String(value.chain.chainId) !== '11155111' || ids.core.toLowerCase() !== CONTRACTS.core || ids.token.toLowerCase() !== CONTRACTS.token || ids.genesis.toLowerCase() !== CONTRACTS.nft || ids.mining.proxy.toLowerCase() !== CONTRACTS.mining || ids.staking.proxy.toLowerCase() !== CONTRACTS.staking) {
      throw new Error('Deployment changed. This console is pinned to the contracts listed below.')
    }
    return value
  }, refetchInterval: 15_000 })
  const chain = useQuery({ queryKey: ['chain'], queryFn: readChain, refetchInterval: 15_000 })
  return { status, economy, chain }
}

/** Split provider ranges, with adaptive subdivision when an RPC imposes a smaller log limit. */
async function logRange(params: Record<string, unknown>, fromBlock: bigint, toBlock: bigint): Promise<Log[]> {
  try {
    return await publicClient.getLogs({ ...params, fromBlock, toBlock } as Parameters<typeof publicClient.getLogs>[0])
  } catch (error) {
    if (/pruned|history unavailable|archive/i.test(String(error))) throw error
    if (toBlock - fromBlock < 100n) throw error
    const middle = (fromBlock + toBlock) / 2n
    return [...await logRange(params, fromBlock, middle), ...await logRange(params, middle + 1n, toBlock)]
  }
}

export async function scanLogs(params: Record<string, unknown>, fromBlock: bigint, toBlock: bigint, progress?: (block: bigint) => void) {
  const result: Log[] = []
  for (let from = fromBlock; from <= toBlock; from += 5000n) {
    const to = from + 4999n > toBlock ? toBlock : from + 4999n
    result.push(...await logRange(params, from, to))
    progress?.(to)
  }
  return result.filter(log => !log.removed)
}

export type Keeper = { address: Address; count: number; last: number; hash: Hex }
const checkpointMetadata = new Map<Hex, { sender: Address; time: number }>()
type EventPage = {
  status: string; nextCursor: string | null
  chain: { chainId: string; safeThroughBlock: string }
  identities: { mining: { proxy: string } }
  events: { type: string; occurredAt: string; source: { kind: string; chainId: string; contractAddress: string; transactionHash: Hex; blockNumber: string } }[]
}
async function indexedCheckpoints(through: bigint) {
  let cursor: string | undefined
  const checkpoints = new Map<Hex, { block: bigint; time: number }>()
  let safe = through
  for (let page = 0; page < 200; page++) {
    const value = await fetchApi<EventPage>(`/events?category=protocol&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
    if (value.status !== 'available' || value.chain?.chainId !== '11155111' || value.identities?.mining?.proxy.toLowerCase() !== CONTRACTS.mining || !Array.isArray(value.events)) throw new Error('Indexed checkpoint history is unavailable or belongs to a different deployment.')
    safe = BigInt(value.chain.safeThroughBlock) < through ? BigInt(value.chain.safeThroughBlock) : through
    for (const event of value.events) {
      if (event.type !== 'system.mining_checkpointed' || event.source.kind !== 'chain' || event.source.chainId !== '11155111' || event.source.contractAddress.toLowerCase() !== CONTRACTS.mining) continue
      const block = BigInt(event.source.blockNumber)
      const time = Date.parse(event.occurredAt)
      if (block >= DEPLOYMENT_BLOCK && block <= safe && /^0x[\da-f]{64}$/i.test(event.source.transactionHash) && Number.isFinite(time)) checkpoints.set(event.source.transactionHash, { block, time })
    }
    if (!value.nextCursor) return { checkpoints, safe }
    if (cursor === value.nextCursor) throw new Error('Checkpoint pagination did not advance.')
    cursor = value.nextCursor
  }
  throw new Error('Checkpoint history is too large to load completely. Try again later.')
}
export async function readKeepers(progress?: (block: bigint) => void) {
  // Read 12 confirmations behind the tip. Full scan, never a seeded or browser-only leaderboard.
  const tip = await publicClient.getBlockNumber({ cacheTime: 0 })
  let through = tip - 12n
  let source = 'RPC contract events'
  const unique = new Map<Hex, bigint>()
  const blocks = new Map<bigint, number>()
  try {
    const logs = await scanLogs({ address: CONTRACTS.mining, event: parseAbiItem('event Checkpointed(uint64 indexed throughRound, uint64 fundedBlocks, uint256 amount)') }, DEPLOYMENT_BLOCK, through, progress)
    for (const log of logs) if (log.transactionHash && log.blockNumber) unique.set(log.transactionHash, log.blockNumber)
  } catch {
    // Some public providers prune log history. The official API indexes these same contract events.
    // Still resolve each real transaction's sender by RPC; never replace missing callers with samples.
    const indexed = await indexedCheckpoints(through)
    through = indexed.safe
    source = 'API-indexed contract events'
    for (const [hash, entry] of indexed.checkpoints) { unique.set(hash, entry.block); blocks.set(entry.block, entry.time) }
  }
  const rows = new Map<string, Keeper>()
  const hashes = [...unique.entries()]
  // Bounded concurrency prevents a history scan from overwhelming a public provider.
  for (let i = 0; i < hashes.length; i += 8) {
    await Promise.all(hashes.slice(i, i + 8).map(async ([hash, blockNumber]) => {
      const cached = checkpointMetadata.get(hash)
      const sender = cached?.sender ?? (await publicClient.getTransaction({ hash })).from
      let time = cached?.time ?? blocks.get(blockNumber)
      if (!time) {
        time = Number((await publicClient.getBlock({ blockNumber })).timestamp) * 1000
        blocks.set(blockNumber, time)
      }
      const address = getAddress(sender)
      checkpointMetadata.set(hash, { sender: address, time })
      const row = rows.get(address) ?? { address, count: 0, last: 0, hash }
      row.count++
      if (time > row.last) { row.last = time; row.hash = hash }
      rows.set(address, row)
    }))
  }
  return { rows: [...rows.values()].sort((a, b) => b.count - a.count || b.last - a.last), through, transactions: unique.size, source }
}

export type Squeek = { id: string; level: number; custody: 'wallet' | 'staking' }
type AccountPage = {
  status: string
  chain: { indexedThroughBlock: string }
  tokens?: { tokenId: string; custody: 'wallet' | 'staking'; level: number }[]
  nextCursor?: string | null
}

async function candidateIds(account: Address, through: bigint) {
  // API is the quick index. Ownership and depositor are always verified by RPC below.
  try {
    let cursor: string | undefined
    const ids = new Set<string>()
    let indexed = DEPLOYMENT_BLOCK
    for (let page = 0; page < 200; page++) {
      const value = await fetchApi<AccountPage>(`/accounts/${account}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
      if (value.status !== 'available' || !Array.isArray(value.tokens) || !value.chain?.indexedThroughBlock) throw new Error('Account index unavailable')
      value.tokens.forEach(t => ids.add(t.tokenId))
      indexed = BigInt(value.chain.indexedThroughBlock)
      if (!value.nextCursor) return { ids, from: indexed > DEPLOYMENT_BLOCK ? indexed - 12n : DEPLOYMENT_BLOCK }
      if (value.nextCursor === cursor) throw new Error('Account pagination did not advance')
      cursor = value.nextCursor
    }
    throw new Error('Account index pagination limit reached')
  } catch {
    // ERC-721 is not Enumerable. Replay incoming transfers and staking deposits, then recheck custody.
    const [transfers, deposits] = await Promise.all([
      scanLogs({ address: CONTRACTS.nft, event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'), args: { to: account } }, DEPLOYMENT_BLOCK, through),
      scanLogs({ address: CONTRACTS.staking, event: parseAbiItem('event Deposited(address indexed account, address indexed collection, uint256 indexed tokenId, uint8 level, uint64 basePower, uint256 power)'), args: { account, collection: CONTRACTS.nft } }, DEPLOYMENT_BLOCK, through),
    ])
    const ids = new Set<string>()
    for (const log of [...transfers, ...deposits]) if (log.topics[3]) ids.add(BigInt(log.topics[3]).toString())
    return { ids, from: through + 1n }
  }
}

export async function readAccount(address: Address) {
  const readAt = Date.now()
  const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 })
  const [balance, sqk, allowance, power, claimable, approved, stake, recipient, maxTokens, candidates] = await Promise.all([
    publicClient.getBalance({ address, blockNumber }),
    publicClient.readContract({ address: CONTRACTS.token, abi: tokenAbi, functionName: 'balanceOf', args: [address], blockNumber }),
    publicClient.readContract({ address: CONTRACTS.token, abi: tokenAbi, functionName: 'allowance', args: [address, CONTRACTS.staking], blockNumber }),
    publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'accountPower', args: [address], blockNumber }),
    publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'claimable', args: [address], blockNumber }),
    publicClient.readContract({ address: CONTRACTS.nft, abi: nftAbi, functionName: 'isApprovedForAll', args: [address, CONTRACTS.staking], blockNumber }),
    publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'stakeOf', args: [address], blockNumber }),
    publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'claimRecipient', args: [address], blockNumber }),
    publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'MAX_TOKENS', blockNumber }),
    candidateIds(address, blockNumber),
  ])
  if (candidates.from <= blockNumber) {
    const [transfers, deposits] = await Promise.all([
      scanLogs({ address: CONTRACTS.nft, event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'), args: { to: address } }, candidates.from, blockNumber),
      scanLogs({ address: CONTRACTS.staking, event: parseAbiItem('event Deposited(address indexed account, address indexed collection, uint256 indexed tokenId, uint8 level, uint64 basePower, uint256 power)'), args: { account: address, collection: CONTRACTS.nft } }, candidates.from, blockNumber),
    ])
    for (const log of [...transfers, ...deposits]) if (log.topics[3]) candidates.ids.add(BigInt(log.topics[3]).toString())
  }
  const tokens: Squeek[] = []
  const ids = [...candidates.ids]
  for (let i = 0; i < ids.length; i += 20) {
    await Promise.all(ids.slice(i, i + 20).map(async id => {
      // Burned candidates are expected; any unrelated RPC failure must remain an error.
      const ownerResult = await publicClient.multicall({ contracts: [{ address: CONTRACTS.nft, abi: nftAbi, functionName: 'ownerOf', args: [BigInt(id)] }], blockNumber })
      if (ownerResult[0].status === 'failure') {
        if (/ERC721NonexistentToken|nonexistent|revert/i.test(ownerResult[0].error.message)) return
        throw ownerResult[0].error
      }
      const owner = ownerResult[0].result.toLowerCase()
      let custody: Squeek['custody'] | undefined
      if (owner === address.toLowerCase()) custody = 'wallet'
      else if (owner === CONTRACTS.staking) {
        const depositor = await publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'depositor', args: [CONTRACTS.nft, BigInt(id)], blockNumber })
        if (depositor.toLowerCase() === address.toLowerCase()) custody = 'staking'
      }
      if (custody) {
        const level = await publicClient.readContract({ address: CONTRACTS.nft, abi: nftAbi, functionName: 'level', args: [BigInt(id)], blockNumber })
        tokens.push({ id, level, custody })
      }
    }))
  }
  tokens.sort((a, b) => Number(BigInt(a.id) - BigInt(b.id)))
  return { balance, sqk, allowance, power, claimable, approved, stake, recipient: recipient === zeroAddress ? address : recipient, maxTokens, tokens, blockNumber, readAt }
}

export function useHolder() {
  const { address } = useAccount()
  return useQuery({ queryKey: ['holder', address], queryFn: () => readAccount(address!), enabled: Boolean(address), refetchInterval: 30_000 })
}
