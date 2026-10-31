import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { sepolia } from 'viem/chains'
import { publicClient } from './chain'
import { AddressLink, Icon, Modal } from './components'
import { amount, errorMessage, short } from './format'
import { OPEN_IN } from './open-in'

export function Wallet() {
  const account = useAccount()
  const { connectors, connectAsync, isPending, variables } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync, isPending: switching } = useSwitchChain()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const balance = useQuery({ queryKey: ['eth', account.address], queryFn: () => publicClient.getBalance({ address: account.address! }), enabled: Boolean(account.address), refetchInterval: 15_000 })
  const named = connectors.some(c => c.type === 'injected' && c.id !== 'injected')
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !named && !(window as Window & { ethereum?: unknown }).ethereum
  const listed = [...connectors.filter(c => c.type === 'injected'), ...connectors.filter(c => c.type !== 'injected')]
    .filter(c => !(c.id === 'injected' && named) && !(mobile && c.type === 'injected'))
  const wrongChain = account.isConnected && account.chainId !== sepolia.id

  async function switchNetwork() {
    setError('')
    try { await switchChainAsync({ chainId: sepolia.id }) } catch (e) { setError(errorMessage(e)); setOpen(true) }
  }

  return <>
    <button type="button" className="wallet-button" onClick={() => { if (wrongChain) void switchNetwork(); else { setError(''); setOpen(true) } }} disabled={switching}>
      <Icon name="wallet" size={18} /><span>{switching ? 'Switching…' : wrongChain ? 'Switch to Sepolia' : account.address ? short(account.address) : 'Connect wallet'}</span>
    </button>
    {open && <Modal title={account.isConnected ? 'Connected wallet' : 'Connect a wallet'} onClose={() => setOpen(false)}>
      {account.address ? <>
        <p className="muted">{wrongChain ? 'Switch to Sepolia to enable transactions.' : 'Sepolia · Chain ID 11155111'}</p>
        <AddressLink address={account.address} full />
        <div className="wallet-balance"><span>Sepolia ETH balance</span><strong>{balance.data !== undefined ? `${amount(balance.data, 6)} ETH` : balance.isError ? 'Unavailable' : 'Reading…'}</strong></div>
        {wrongChain && <button className="button primary" onClick={() => void switchNetwork()} disabled={switching}>{switching ? 'Switching…' : 'Switch to Sepolia'}<Icon name="arrow" /></button>}
        <button className="button secondary" onClick={() => { disconnect(); setOpen(false) }}>Disconnect wallet</button>
      </> : <>
        <p className="muted">Choose a wallet to connect to Sepolia.</p>
        <div className="wallet-options">
          {mobile && OPEN_IN.map(w => <a className="wallet-row" key={w.id} href={w.href(location.href)}><img src={`./wallets/${w.id}.svg`} width="28" height="28" alt="" /><span>Open in {w.name}</span><Icon name="external" size={18} /></a>)}
          {listed.map(connector => <button type="button" className="wallet-row" key={connector.uid} disabled={isPending} onClick={async () => {
            setError('')
            try {
              await connectAsync({ connector, chainId: sepolia.id })
              setOpen(false)
            } catch (e) { setError(connector.id === 'injected' && /provider|not found/i.test(String(e)) ? 'No browser wallet found. Install a wallet extension or choose Coinbase Wallet.' : errorMessage(e)) }
          }}>
            {connector.icon ? <img src={connector.icon} width="28" height="28" alt="" /> : connector.id === 'coinbaseWalletSDK' ? <img src="./wallets/coinbase.svg" width="28" height="28" alt="" /> : <Icon name="wallet" size={28} />}
            <span>{connector.id === 'injected' ? 'Browser wallet' : connector.id === 'coinbaseWalletSDK' && mobile ? 'Coinbase Smart Wallet' : connector.name}{isPending && variables?.connector === connector ? ' · opening…' : ''}</span><Icon name="arrow" size={18} />
          </button>)}
        </div>
        <p className="wallet-note"><Icon name="shield" size={16} />Your wallet keeps your keys. Every transaction needs your approval.</p>
      </>}
      <p className="inline-error" role="status">{error}</p>
    </Modal>}
  </>
}
