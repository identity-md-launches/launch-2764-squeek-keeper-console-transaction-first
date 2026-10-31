import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { encodeFunctionData, formatEther, getAddress, type Address, type Hex } from 'viem'
import { CONTRACTS, miningAbi, nftAbi, publicClient, stakingAbi, tokenAbi } from './chain'
import { readChain } from './data'

export type Intent =
  | { kind: 'checkpoint' }
  | { kind: 'nftApproval'; approved: boolean }
  | { kind: 'deposit'; ids: string[] }
  | { kind: 'claim' }
  | { kind: 'compound' }
  | { kind: 'approve'; amount: bigint }
  | { kind: 'stake'; amount: bigint }
  | { kind: 'ping' }

export type Preview = {
  title: string; description: string; method: string; to: Address; data: Hex
  details: { label: string; value: string; address?: boolean }[]
  warning?: string; fee: bigint; gas: bigint; sender: Address; recipient?: Address
}

export async function prepareTransaction(intent: Intent, account: Address): Promise<Preview> {
  let title = ''; let description = ''; let method = ''; let to: Address = CONTRACTS.staking; let data: Hex = '0x'; let warning: string | undefined; let recipient: Address | undefined
  const details: Preview['details'] = []
  switch (intent.kind) {
    case 'checkpoint': {
      const state = await readChain()
      if (state.corePaused || state.mining.paused || !state.mining.active || !state.roundSettled || state.pending === 0n) throw new Error('No checkpoint is available. Refresh the Keeper desk.')
      title = 'Run checkpoint'; description = 'Process settled rounds for the whole Squeekchain economy. You pay the Sepolia gas fee; this action gives you no keeper reward.'
      method = 'checkpoint()'; to = CONTRACTS.mining; data = encodeFunctionData({ abi: miningAbi, functionName: 'checkpoint' })
      details.push({ label: 'Pending settled rounds', value: state.pending.toString() })
      break
    }
    case 'nftApproval':
      title = intent.approved ? 'Approve Squeeks' : 'Revoke Squeek approval'; method = 'setApprovalForAll(address,bool)'; to = CONTRACTS.nft
      description = intent.approved ? 'Allow Staking to transfer every Squeek in this collection that you own, including ones you receive later. Approval alone does not deposit them.' : 'Remove Staking’s permission to transfer your wallet’s Squeeks. Deposited NFTs stay in Staking.'
      data = encodeFunctionData({ abi: nftAbi, functionName: 'setApprovalForAll', args: [CONTRACTS.staking, intent.approved] })
      details.push({ label: 'Operator', value: CONTRACTS.staking, address: true }, { label: 'All Squeeks approved', value: intent.approved ? 'Yes' : 'No' })
      break
    case 'deposit': {
      if (!intent.ids.length) throw new Error('Select at least one Squeek.')
      const ids = [...new Set(intent.ids)].map(BigInt).sort((a, b) => a < b ? -1 : 1)
      const max = await publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'MAX_TOKENS' })
      if (BigInt(ids.length) > max) throw new Error(`Select at most ${max} Squeeks per transaction.`)
      const owners = await Promise.all(ids.map(id => publicClient.readContract({ address: CONTRACTS.nft, abi: nftAbi, functionName: 'ownerOf', args: [id] })))
      if (owners.some(owner => owner.toLowerCase() !== account.toLowerCase())) throw new Error('NFT ownership changed. Refresh the Holder desk.')
      title = 'Deposit Squeeks'; method = 'deposit(address,uint256[])'; description = 'Transfer the selected Squeeks from your wallet into Staking custody and add their power to your account.'
      data = encodeFunctionData({ abi: stakingAbi, functionName: 'deposit', args: [CONTRACTS.nft, ids] })
      details.push({ label: 'Squeek token IDs', value: ids.map(id => `#${id}`).join(', ') }, { label: 'Collection', value: CONTRACTS.nft, address: true })
      break
    }
    case 'claim':
    case 'compound': {
      const [claimable, configured] = await Promise.all([
        publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'claimable', args: [account] }),
        publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'claimRecipient', args: [account] }),
      ])
      if (!claimable) throw new Error('Nothing is claimable right now. Refresh after the next checkpoint.')
      recipient = BigInt(configured) === 0n ? account : configured
      title = intent.kind === 'claim' ? 'Claim rewards' : 'Claim and stake'; method = intent.kind === 'claim' ? 'claim(address)' : 'claimAndStake()'
      description = intent.kind === 'claim' ? 'Claim your currently available SQK rewards to the account’s configured recipient.' : 'Claim your rewards directly into your own SQK stake. The amount becomes fresh staking principal.'
      data = intent.kind === 'claim' ? encodeFunctionData({ abi: stakingAbi, functionName: 'claim', args: [account] }) : encodeFunctionData({ abi: stakingAbi, functionName: 'claimAndStake' })
      details.push({ label: 'Current claimable (estimate)', value: `${formatEther(claimable)} SQK` }, { label: intent.kind === 'claim' ? 'Rewards recipient' : 'Stake owner', value: intent.kind === 'claim' ? recipient : account, address: true })
      if (intent.kind === 'compound') warning = 'Staked SQK is subject to the protocol’s withdrawal fee. Review the exit policy before staking.'
      break
    }
    case 'approve':
      if (intent.amount <= 0n) throw new Error('Enter an amount greater than zero.')
      title = 'Approve SQK'; method = 'approve(address,uint256)'; to = CONTRACTS.token
      description = 'Set Staking’s SQK spending allowance to exactly this amount. You will review a separate transaction to stake.'
      data = encodeFunctionData({ abi: tokenAbi, functionName: 'approve', args: [CONTRACTS.staking, intent.amount] })
      details.push({ label: 'New allowance', value: `${formatEther(intent.amount)} SQK` }, { label: 'Spender', value: CONTRACTS.staking, address: true })
      break
    case 'stake':
      if (intent.amount <= 0n) throw new Error('Enter an amount greater than zero.')
      title = 'Stake SQK'; method = 'stake(uint256)'; description = 'Move this exact amount of SQK from your wallet into your own Staking principal.'
      data = encodeFunctionData({ abi: stakingAbi, functionName: 'stake', args: [intent.amount] })
      details.push({ label: 'SQK to stake', value: `${formatEther(intent.amount)} SQK` }, { label: 'Stake owner', value: account, address: true })
      warning = 'Staked SQK is subject to the protocol’s withdrawal fee. Review the exit policy before staking.'
      break
    case 'ping':
      title = 'Send a ping'; method = 'approve(address,uint256)'; to = CONTRACTS.token
      description = 'Send a real first transaction by setting your own SQK allowance to zero. This transfers no SQK and changes no Staking allowance. You pay the Sepolia gas fee.'
      data = encodeFunctionData({ abi: tokenAbi, functionName: 'approve', args: [account, 0n] })
      details.push({ label: 'Spender (your own address)', value: account, address: true }, { label: 'Allowance', value: '0 SQK' })
      break
  }
  await publicClient.call({ account, to, data, value: 0n })
  const [gas, gasPrice] = await Promise.all([publicClient.estimateGas({ account, to, data, value: 0n }), publicClient.getGasPrice()])
  return { title, description, method, to, data, details, warning, sender: getAddress(account), recipient, fee: gas * gasPrice, gas }
}

export type Tx = { hash: Hex; account: Address; title: string; at: number; status: 'Pending' | 'Confirmed' | 'Reverted'; chainId: 11155111 }
const STORAGE_KEY = 'squeek-keeper:transactions:v1'
function loadTransactions(): Tx[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((tx): tx is Tx => tx && /^0x[\da-fA-F]{64}$/.test(tx.hash) && /^0x[\da-fA-F]{40}$/.test(tx.account) && typeof tx.title === 'string' && typeof tx.at === 'number' && tx.chainId === 11155111 && ['Pending', 'Confirmed', 'Reverted'].includes(tx.status))
  } catch { return [] }
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Tx[]>(loadTransactions)
  const [storageError, setStorageError] = useState(false)
  const queryClient = useQueryClient()
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); setStorageError(false) } catch { setStorageError(true) }
  }, [transactions])
  const pending = transactions.filter(tx => tx.status === 'Pending').map(tx => tx.hash).join(',')
  useEffect(() => {
    if (!pending) return
    let active = true
    const check = async () => {
      for (const hash of pending.split(',') as Hex[]) {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash })
          if (!active) return
          setTransactions(current => current.map(tx => tx.hash === hash ? { ...tx, status: receipt.status === 'success' ? 'Confirmed' : 'Reverted' } : tx))
          for (const key of ['chain', 'holder', 'eth', 'keepers']) void queryClient.invalidateQueries({ queryKey: [key] })
        } catch { /* Missing receipts and transient RPC errors keep an honest pending status. */ }
      }
    }
    void check()
    const interval = setInterval(() => void check(), 15_000)
    return () => { active = false; clearInterval(interval) }
  }, [pending, queryClient])
  return { transactions, storageError, add: (tx: Tx) => setTransactions(current => [tx, ...current.filter(item => item.hash !== tx.hash)]) }
}
