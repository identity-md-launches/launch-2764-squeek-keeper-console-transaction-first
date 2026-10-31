import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useWalletClient } from 'wagmi'
import { sepolia } from 'viem/chains'
import { type Hex, formatEther } from 'viem'
import { AddressLink, Icon, Modal, Notice } from './components'
import { CONTRACTS, publicClient, stakingAbi } from './chain'
import { amount, errorMessage } from './format'
import { type Intent, type Tx, prepareTransaction } from './transactions'

export function ReviewTransaction({ intent, onClose, onSent }: { intent: Intent; onClose: () => void; onSent: (tx: Tx) => void }) {
  const { address, chainId, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<Hex>()
  const preview = useQuery({
    queryKey: ['preview', address, chainId, JSON.stringify(intent, (_, value) => typeof value === 'bigint' ? value.toString() : value)],
    queryFn: () => prepareTransaction(intent, address!),
    enabled: Boolean(address && chainId === sepolia.id), retry: false, staleTime: 0, gcTime: 0,
  })
  async function send() {
    if (!preview.data || !walletClient || !address || chainId !== sepolia.id || sent || sending) return
    setError(''); setSending(true)
    try {
      if (await walletClient.getChainId() !== sepolia.id || preview.data.sender.toLowerCase() !== address.toLowerCase()) throw new Error('Wallet or network changed. Close this preview and review the action again.')
      const accounts = await walletClient.getAddresses()
      if (accounts[0]?.toLowerCase() !== address.toLowerCase()) throw new Error('The active wallet account changed. Reconnect and try again.')
      if (intent.kind === 'claim') {
        const configured = await publicClient.readContract({ address: CONTRACTS.staking, abi: stakingAbi, functionName: 'claimRecipient', args: [address] })
        const recipient = BigInt(configured) === 0n ? address : configured
        if (recipient.toLowerCase() !== preview.data.recipient?.toLowerCase()) throw new Error('The reward recipient changed. Close this preview and review it again.')
      }
      await publicClient.call({ account: address, to: preview.data.to, data: preview.data.data, value: 0n })
      const hash = await walletClient.sendTransaction({ account: address, chain: sepolia, to: preview.data.to, data: preview.data.data, value: 0n })
      setSent(hash)
      onSent({ hash, account: address, title: preview.data.title, at: Date.now(), status: 'Pending', chainId: 11155111 })
    } catch (e) { setError(errorMessage(e)) } finally { setSending(false) }
  }
  const wrong = !isConnected || chainId !== sepolia.id
  return <Modal title={sent ? 'Transaction sent' : preview.data?.title ?? 'Review transaction'} onClose={onClose} busy={sending}>
    {sent ? <div className="sent-state"><div className="success-mark"><Icon name="check" size={30} /></div><h3>On its way to Sepolia</h3><p>The transaction is pending. Follow its receipt in the activity log.</p><a className="hash-link" href={`https://sepolia.etherscan.io/tx/${sent}`} target="_blank" rel="noreferrer">{sent}<Icon name="external" size={16} /></a><button className="button primary" onClick={onClose}>Back to the console<Icon name="arrow" /></button></div> : <>
      {wrong ? <Notice error>Connect your wallet to Sepolia, then review the action again.</Notice> : preview.isPending ? <div className="preview-loading" role="status"><Icon name="refresh" />Simulating the transaction and estimating gas…</div> : preview.isError ? <><Notice error>{errorMessage(preview.error)}</Notice><button className="button secondary" onClick={() => void preview.refetch()}>Retry simulation<Icon name="refresh" /></button></> : preview.data && <>
        <p>{preview.data.description}</p>
        <dl className="preview-details">
          <div><dt>Network</dt><dd>Sepolia · 11155111</dd></div>
          <div><dt>From your wallet</dt><dd><AddressLink address={preview.data.sender} full /></dd></div>
          <div><dt>Contract</dt><dd><AddressLink address={preview.data.to} full /></dd></div>
          <div><dt>Method</dt><dd><code>{preview.data.method}</code></dd></div>
          {preview.data.details.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.address ? <AddressLink address={detail.value} full /> : detail.value}</dd></div>)}
          <div><dt>ETH sent to contract</dt><dd>0 ETH</dd></div>
          <div><dt>Estimated network fee</dt><dd title={`${formatEther(preview.data.fee)} ETH`}>{amount(preview.data.fee, 8)} Sepolia ETH</dd></div>
        </dl>
        {preview.data.warning && <Notice>{preview.data.warning} <a href="https://docs.squeekchain.com/rewards/staking/" target="_blank" rel="noreferrer">Read the staking policy<Icon name="external" size={14} /></a></Notice>}
        <p className="muted small-copy">Simulation passed. The final amount and fee may change before your wallet confirms.</p>
        <button className="button primary" onClick={() => void send()} disabled={sending || !walletClient}>{sending ? 'Confirm in your wallet…' : 'Confirm in wallet'}<Icon name="wallet" /></button>
      </>}
      <p className="inline-error" role="status">{error}</p>
    </>}
  </Modal>
}
