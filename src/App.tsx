import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import { CONTRACTS, EXPLORER } from './chain'
import { Action, AddressLink, Hamster, Icon, Notice } from './components'
import { useHolder, useLiveData, readKeepers } from './data'
import { amount, date, errorMessage, integer } from './format'
import { ReviewTransaction } from './ReviewTransaction'
import { type Intent, useTransactions } from './transactions'
import { Wallet } from './Wallet'

function WheelStrip({ live }: { live: ReturnType<typeof useLiveData> }) {
  const telemetry = live.status.data?.measurement
  const stale = !telemetry || live.status.isError || telemetry.freshness !== 'online' || Date.now() - Date.parse(telemetry.observedAt) > (telemetry.staleAfterSeconds ?? 120) * 1000
  const spinning = !stale && (telemetry.coreStatus === 'ACTIVE' || telemetry.rpmMilli > 0 || telemetry.speedMmPerSecond > 0)
  const chain = live.chain.data?.core
  const fallback = live.status.data?.builder?.anchor
  const height = chain?.blockHeight ?? (fallback ? BigInt(fallback.blockHeight) : undefined)
  const units = chain?.blockProgress ?? (fallback ? BigInt(fallback.blockProgress) : undefined)
  const progress = units !== undefined ? Number(units) / 10_000_000 : undefined
  return <div className="wheel-strip" aria-label="Live wheel telemetry">
    <div className="wheel-live"><Icon name="wheel" size={24} /><div><span className="strip-label">Wheel status</span><strong><i className={`status-dot ${stale ? 'offline' : spinning ? 'spinning' : ''}`} />{stale ? 'Unavailable' : spinning ? 'SPINNING' : 'IDLE'}</strong></div></div>
    <div className="strip-rpm"><span className="strip-label">RPM</span><strong className="numeric">{!stale ? (telemetry.rpmMilli / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—'}</strong></div>
    <div className="strip-height"><span className="strip-label">Squeek block</span><strong className="numeric">{height !== undefined ? `#${integer(height)}` : 'Reading…'}</strong></div>
    <div className="strip-progress"><div className="progress-label"><span className="strip-label">Next Squeek block</span><strong className="numeric">{progress !== undefined ? `${progress.toFixed(1)}%` : 'Reading…'}</strong></div><progress aria-label="Progress to next Squeek block" max={100} value={progress ?? 0} /></div>
    <span className="refresh-note"><Icon name="refresh" size={14} />Every 15s</span>
  </div>
}

function WheelScene() {
  return <div className="wheel-scene" aria-hidden="true">
    <div className="scene-grid" />
    <span className="scene-caption">WHEELY9000</span>
    <svg className="scene-svg" viewBox="0 0 360 250" fill="none" shapeRendering="crispEdges">
      <path fill="#fff8e8" d="M34 46h16v-8h24v8h16v8H34Zm230-18h16v-8h24v8h24v8h-64Z" />
      <path stroke="#738c61" strokeWidth="8" d="m143 204-17 25m91-25 17 25M112 230h137" />
      <path fill="#a8bf88" d="M125 42h110v8h16v12h16v18h10v22h7v55h-7v22h-10v17h-16v12h-16v8H125v-8h-16v-12H93v-17H83v-22h-7v-55h7V80h10V62h16V50h16Z" />
      <path fill="#dce8bc" d="M131 53h98v8h16v12h14v14h9v22h5v42h-5v23h-9v15h-14v11h-16v7h-98v-7h-16v-11h-14v-15h-9v-23h-5v-42h5V87h9V73h14V61h16Z" />
      <path stroke="#a8bf88" strokeWidth="4" d="M180 58v150M100 130h168M124 76l112 112M124 185 236 76" />
      <path stroke="#738c61" strokeWidth="4" d="M131 53h98v8h16v12h14v14h9v22h5v42h-5v23h-9v15h-14v11h-16v7h-98v-7h-16v-11h-14v-15h-9v-23h-5v-42h5V87h9V73h14V61h16Z" />
      <path fill="#738c61" d="M171 121h18v18h-18Z" /><path fill="#edf1d8" d="M176 126h8v8h-8Z" />
      <path fill="#879a6d" d="M22 232h316v3H22Z" />
      <path fill="#a2b17b" d="M31 215h4v17h-4Zm-6 5h6v4h-6Zm10-7h6v4h-6Zm282 1h4v18h-4Zm-6 5h6v4h-6Zm10 2h6v4h-6Z" />
      <g transform="translate(180 147) scale(1.9)">
        <path fill="#794c31" d="M5 2h7v3h8V2h7v10h3v11h-4v3H6v-3H2V12h3Z" />
        <path fill="#d89b57" d="M7 4h3v4h12V4h3v10h3v7h-4v3H8v-3H4v-7h3Z" />
        <path fill="#f2b6a0" d="M7 5h3v5H7zm15 0h3v5h-3Z" />
        <path fill="#fff3d7" d="M10 12h12v3h3v6h-3v3H10v-3H7v-6h3Z" />
        <path fill="#302e25" d="M9 11h3v3H9zm11 0h3v3h-3Zm-6 6h4v3h-4Zm-1 5h6v2h-6Z" />
        <path fill="#e9a58d" d="M6 16h4v3H6zm16 0h4v3h-4Z" />
      </g>
    </svg>
    <div className="scene-footer"><span className="pixel-square" />Work starts at the wheel</div>
  </div>
}

function Leaderboard() {
  const [scanned, setScanned] = useState<bigint>()
  const [all, setAll] = useState(false)
  const keepers = useQuery({ queryKey: ['keepers'], queryFn: () => readKeepers(setScanned), staleTime: 120_000, refetchInterval: 120_000, retry: false })
  const rows = keepers.data?.rows ?? []
  return <div className="leaderboard">
    <div className="subsection-heading"><h3>Keeper leaderboard</h3><span className="small-copy muted">From checkpoint events</span></div>
    {keepers.isPending ? <div className="table-empty" role="status"><Icon name="refresh" /><p>Reading checkpoint history{scanned ? ` through block ${integer(scanned)}` : ''}…</p></div> : keepers.isError ? <Notice error>Checkpoint history could not be fully loaded. <button className="text-button" onClick={() => void keepers.refetch()}>Retry leaderboard</button></Notice> : !rows.length ? <div className="table-empty"><Icon name="wheel" /><p>No checkpoint events found yet. The first keeper will appear here.</p></div> : <>
      <div className="keeper-table" role="table" aria-label="Keeper leaderboard">
        <div className="keeper-row table-head" role="row"><span role="columnheader">Keeper wallet</span><span role="columnheader">Checkpoints</span><span role="columnheader">Last checkpoint</span></div>
        {(all ? rows : rows.slice(0, 5)).map((row, index) => <div className="keeper-row" key={row.address} role="row"><span className="keeper-wallet" role="cell"><span className={`rank ${index === 0 ? 'first' : ''}`}>{String(index + 1).padStart(2, '0')}</span><AddressLink address={row.address} /></span><strong className="numeric keeper-count" role="cell">{integer(row.count)}</strong><span role="cell"><a className="last-checkpoint" href={`${EXPLORER}/tx/${row.hash}`} target="_blank" rel="noreferrer" aria-label={`${date(row.last)} checkpoint transaction on Sepolia Etherscan`}><time dateTime={new Date(row.last).toISOString()}>{date(row.last)}</time><Icon name="external" size={14} /></a></span></div>)}
      </div>
      {rows.length > 5 && <button className="text-button show-all" onClick={() => setAll(!all)}>{all ? 'Show top 5' : `Show all ${rows.length} keepers`}<Icon name="arrow" size={16} /></button>}
      <p className="table-footnote">{integer(keepers.data!.transactions)} checkpoint transactions · {keepers.data!.source} through Sepolia block {integer(keepers.data!.through)}. One count per transaction, attributed to its sender. Relayed calls may show a relayer.</p>
    </>}
  </div>
}

export function App() {
  const live = useLiveData()
  const holder = useHolder()
  const account = useAccount()
  const txLog = useTransactions()
  const [intent, setIntent] = useState<Intent>()
  const [selected, setSelected] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [active, setActive] = useState(location.hash || '#keeper')
  const [refreshMessage, setRefreshMessage] = useState('')
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(interval) }, [])
  useEffect(() => { setSelected([]); setIntent(undefined); setInput('') }, [account.address])
  useEffect(() => { setSelected(current => current.filter(id => holder.data?.tokens.some(t => t.id === id && t.custody === 'wallet'))) }, [holder.data])
  useEffect(() => { const change = () => setActive(location.hash || '#keeper'); addEventListener('hashchange', change); return () => removeEventListener('hashchange', change) }, [])

  const walletReason = !account.isConnected ? 'Connect your wallet above.' : account.chainId !== 11155111 ? 'Switch to Sepolia above.' : undefined
  const chainFresh = live.chain.data && now - live.chain.data.readAt < 45_000 && !live.chain.isError
  const accountFresh = holder.data && now - holder.data.readAt < 60_000 && !holder.isError
  const chainReason = walletReason ?? (!chainFresh ? 'Waiting for Sepolia data.' : undefined)
  const holderReason = chainReason ?? (!accountFresh ? holder.isError ? 'Retry account read below.' : 'Reading account data…' : undefined)
  const data = live.chain.data
  const checkpointReason = chainReason ?? (data?.corePaused || data?.mining.paused ? 'Checkpoints are paused by the protocol.' : !data?.mining.active ? 'Mining has not started.' : !data.roundSettled || !data.pending ? 'All settled rounds are checkpointed. Check back after the next settlement.' : undefined)
  const intakeReason = holderReason ?? (data?.stakingPaused ? 'Staking intake is paused by the protocol.' : !data?.ready ? 'Staking is waiting for launch readiness.' : undefined)
  const walletTokens = holder.data?.tokens.filter(t => t.custody === 'wallet') ?? []
  const deposited = holder.data?.tokens.filter(t => t.custody === 'staking') ?? []
  let parsed = 0n; let amountReason: string | undefined
  try {
    if (!/^\d+(\.\d{0,18})?$/.test(input)) throw new Error()
    parsed = parseEther(input)
    if (parsed <= 0n) amountReason = 'Enter an amount greater than zero.'
  } catch { amountReason = input ? 'Use a positive number with at most 18 decimals.' : 'Enter the SQK amount to approve or stake.' }
  const stakeReason = intakeReason ?? amountReason ?? (parsed > (holder.data?.sqk ?? 0n) ? 'This amount exceeds your SQK balance.' : parsed > (holder.data?.allowance ?? 0n) ? 'Approve this amount for Staking first.' : undefined)
  const rewardReason = holderReason ?? (!holder.data?.claimable ? 'No rewards are claimable right now.' : undefined)
  async function refresh() {
    setRefreshMessage('Refreshing contract reads…')
    await Promise.allSettled([live.status.refetch(), live.economy.refetch(), live.chain.refetch(), ...(account.address ? [holder.refetch()] : [])])
    setRefreshMessage('Refresh finished. Each desk shows its current read status.')
  }
  const latestCheckpoint = txLog.transactions.find(tx => tx.title === 'Run checkpoint')
  return <>
    <a className="skip-link" href="#main">Skip to console</a>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#"><Hamster small /><span>Squeek <span className="brand-sub">Keeper Console</span></span></a>
      <div className="header-utilities"><span className="network"><span className="network-diamond" />Sepolia testnet</span><Wallet /></div>
    </div></header>
    <div className="page-shell">
      <nav className="desk-nav" aria-label="Console desks">
        {[['#keeper', 'wheel', 'Keeper'], ['#holder', 'sprout', 'Holder'], ['#sqk', 'coin', 'SQK'], ['#activity', 'history', 'Activity']].map(([href, icon, label]) => <a key={href} href={href} aria-current={active === href ? 'location' : undefined}><Icon name={icon} size={18} />{label}<span className="nav-desktop">{label === 'Activity' ? '' : ' desk'}</span>{label === 'Activity' && txLog.transactions.length > 0 && <span className="activity-count">{txLog.transactions.length}</span>}</a>)}
        <a className="docs-link" href="https://docs.squeekchain.com/" target="_blank" rel="noreferrer">Protocol docs<Icon name="external" size={14} /></a>
      </nav>
      <main id="main" tabIndex={-1}>
        <WheelStrip live={live} />
        <div className="page-intro"><div><h1>Keep the wheel turning.</h1><p>Checkpoint, claim and stake. A little work for the hamster economy.</p></div><div className="read-status"><span className={`status-dot ${chainFresh ? '' : 'offline'}`} />{chainFresh ? 'Sepolia connected' : live.chain.isPending ? 'Connecting to Sepolia…' : 'Sepolia read unavailable'}<button className="icon-button" aria-label="Refresh live data" onClick={() => void refresh()} disabled={live.chain.isFetching}><Icon name="refresh" size={18} /></button></div></div>
        <section id="keeper" className="keeper-section" aria-labelledby="keeper-title">
          <div className="keeper-workbench">
            <div className="checkpoint-panel">
              <div className="section-heading"><h2 id="keeper-title">Keeper desk</h2><span className="permissionless"><Icon name="shield" size={14} />Open to everyone</span></div>
              <div className="pending-line"><strong className="pending-value numeric">{data ? integer(data.pending) : '…'}</strong><div><span>settled rounds</span><span>waiting for a checkpoint</span></div></div>
              <p className="checkpoint-copy">Turn settled wheel work into issued SQK for the whole economy.</p>
              <Action label="Run checkpoint" primary reason={checkpointReason} onClick={() => setIntent({ kind: 'checkpoint' })} />
              <div className="checkpoint-meta"><span><Icon name="wallet" size={14} />You pay Sepolia gas</span><span>No NFT needed</span></div>
              {latestCheckpoint && <div className="checkpoint-result" role="status"><strong>{latestCheckpoint.status === 'Confirmed' ? 'Checkpoint confirmed' : latestCheckpoint.status === 'Reverted' ? 'Checkpoint reverted' : 'Checkpoint pending'}</strong><a className="hash-link" href={`${EXPLORER}/tx/${latestCheckpoint.hash}`} target="_blank" rel="noreferrer">{latestCheckpoint.hash}<Icon name="external" size={14} /></a></div>}
            </div>
            <WheelScene />
          </div>
          <div className="checkpoint-ledger"><span><i className="status-dot" />{data ? `Processed through round ${integer(data.mining.processedThroughRound)}` : 'Reading mining state…'}</span><span>{data ? `Next round ${integer(data.nextRound)}` : 'Waiting for chain data'}<span className="ledger-divider">/</span><AddressLink address={CONTRACTS.mining} /></span></div>
          {live.chain.isError && <Notice error>Contract reads are unavailable. Transaction actions wait for a fresh read. <button className="text-button" onClick={() => void live.chain.refetch()}>Retry Sepolia</button></Notice>}
          <Leaderboard />
        </section>

        <section id="holder" className="desk-section" aria-labelledby="holder-title">
          <div className="desk-title"><span className="section-icon"><Icon name="sprout" size={24} /></span><div><h2 id="holder-title">Holder desk</h2><p>Put your Squeeks to work.</p></div><span className="section-number" aria-hidden="true">02</span></div>
          <div className="holder-summary"><div><span className="stat-label">Squeeks in wallet</span><strong className="numeric">{accountFresh ? integer(walletTokens.length) : '—'}</strong></div><div><span className="stat-label">Deposited in Staking</span><strong className="numeric">{accountFresh ? integer(deposited.length) : '—'}</strong></div><div><span className="stat-label">Account power</span><strong className="numeric">{accountFresh ? amount(holder.data!.power[0] + holder.data!.power[1], 4) : '—'}</strong></div><div><span className="stat-label">Claimable SQK</span><strong className="numeric">{accountFresh ? amount(holder.data!.claimable) : '—'}</strong></div></div>
          {holder.isError && <Notice error>{errorMessage(holder.error)} <button className="text-button" onClick={() => void holder.refetch()}>Retry account read</button></Notice>}
          <div className="holder-columns">
            <div className="nft-desk"><div className="subsection-heading"><h3>Squeek inventory</h3><span className="small-copy muted">Genesis collection</span></div>
              {!account.address ? <div className="inventory-empty"><Hamster /><div><strong>Your crew belongs here.</strong><p>Connect your wallet to see wallet and deposited Squeeks.</p></div></div> : !accountFresh ? <div className="inventory-empty" role="status"><Icon name="refresh" size={32} /><p>{holder.isError ? 'Retry the account read to load your inventory.' : 'Verifying your Squeek inventory on Sepolia…'}</p></div> : holder.data!.tokens.length === 0 ? <div className="inventory-empty"><Hamster /><div><strong>No Squeeks in this wallet.</strong><p>You can still run checkpoints or use the SQK desk.</p></div></div> : <>
                <p className="small-copy muted inventory-help">Select wallet Squeeks to deposit. Deposited Squeeks stay visible below.</p>
                <div className="nft-list">{holder.data!.tokens.map(token => <label className={`nft-row ${token.custody === 'staking' ? 'deposited' : ''}`} key={token.id}>
                  <input type="checkbox" checked={selected.includes(token.id)} disabled={Boolean(intakeReason) || token.custody === 'staking'} onChange={event => setSelected(current => event.target.checked ? [...current, token.id] : current.filter(id => id !== token.id))} /><Hamster small /><span><strong>Squeek #{token.id}</strong><span className="small-copy muted">Level {token.level} · {token.custody === 'wallet' ? 'In wallet' : 'Deposited in Staking'}</span></span><a className="nft-explorer" href={`${EXPLORER}/token/${CONTRACTS.nft}?a=${token.id}`} target="_blank" rel="noreferrer" aria-label={`View Squeek ${token.id} on Etherscan`}><Icon name="external" size={16} /></a>
                </label>)}</div>
              </>}
              <div className="deposit-actions"><Action label={holder.data?.approved ? 'Revoke Squeek approval' : 'Approve Squeeks'} reason={holderReason ?? (!holder.data?.approved && !walletTokens.length ? 'No wallet Squeeks available to approve.' : undefined)} onClick={() => setIntent({ kind: 'nftApproval', approved: !holder.data?.approved })} /><Action label="Deposit selected" reason={intakeReason ?? (!walletTokens.length ? 'No wallet Squeeks available to deposit.' : !holder.data?.approved ? 'Approve Staking for your Squeeks first.' : !selected.length ? 'Select at least one wallet Squeek.' : BigInt(selected.length) > holder.data.maxTokens ? `Select at most ${holder.data.maxTokens} Squeeks.` : undefined)} onClick={() => setIntent({ kind: 'deposit', ids: selected })} /></div>
            </div>
            <div className="rewards-desk"><h3>Collect your rewards</h3><p>Claim SQK to your reward recipient, or add it directly to your stake.</p>
              {accountFresh && <div className="power-breakdown"><span>NFT power<strong className="numeric">{amount(holder.data!.power[0])}</strong></span><span>SQK power<strong className="numeric">{amount(holder.data!.power[1])}</strong></span></div>}
              <Action label="Claim rewards" reason={rewardReason} onClick={() => setIntent({ kind: 'claim' })} />
              <Action label="Claim and stake" reason={intakeReason ?? rewardReason} onClick={() => setIntent({ kind: 'compound' })} />
              {accountFresh && <p className="small-copy muted recipient-note">Rewards recipient <AddressLink address={holder.data!.recipient} /></p>}
            </div>
          </div>
        </section>

        <section id="sqk" className="desk-section" aria-labelledby="sqk-title">
          <div className="desk-title"><span className="section-icon"><Icon name="coin" size={24} /></span><div><h2 id="sqk-title">SQK desk</h2><p>Stake SQK to add account power.</p></div><span className="section-number" aria-hidden="true">03</span></div>
          <div className="sqk-columns"><div className="stake-desk">
            <div className="sqk-balances"><div><span className="stat-label">Wallet balance</span><strong className="numeric">{accountFresh ? `${amount(holder.data!.sqk)} SQK` : '—'}</strong></div><div><span className="stat-label">Staking allowance</span><strong className="numeric" title={holder.data ? `${formatEther(holder.data.allowance)} SQK` : undefined}>{accountFresh ? `${amount(holder.data!.allowance)} SQK` : '—'}</strong></div></div>
            <label className="field-label" htmlFor="sqk-amount">SQK amount</label><div className="amount-field"><input id="sqk-amount" name="sqkAmount" type="text" inputMode="decimal" autoComplete="off" value={input} onChange={event => setInput(event.target.value)} placeholder="0.00" aria-describedby="amount-help" aria-invalid={Boolean(input && amountReason)} /><span>SQK</span><button type="button" className="max-button" disabled={!accountFresh || !holder.data?.sqk} onClick={() => setInput(formatEther(holder.data!.sqk))}>Max</button></div>
            <p className={`small-copy ${input && amountReason ? 'inline-error' : 'muted'}`} id="amount-help">{input && amountReason ? amountReason : 'Approval sets an exact allowance. Staking is a separate transaction.'}</p>
            <div className="sqk-actions"><Action label="Approve SQK" reason={holderReason ?? amountReason} onClick={() => setIntent({ kind: 'approve', amount: parsed })} /><Action label="Stake SQK" reason={stakeReason} onClick={() => setIntent({ kind: 'stake', amount: parsed })} /></div>
            <p className="small-copy muted">Already staked: <strong className="numeric">{accountFresh ? `${amount(holder.data!.stake[0])} SQK` : 'Connect to view'}</strong>. Withdrawal fees apply. <a href="https://docs.squeekchain.com/rewards/staking/" target="_blank" rel="noreferrer">Read the staking policy<Icon name="external" size={12} /></a></p>
          </div><div className="ping-desk"><span className="ping-symbol" aria-hidden="true"><Icon name="wallet" size={28} /><span>0</span></span><h3>Your first onchain squeek</h3><p>Try a safe ping: approve your own address for 0 SQK. It moves no tokens and only costs Sepolia gas.</p><code className="ping-code">approve(yourAddress, 0)</code><Action label="Send a ping" reason={holderReason} onClick={() => setIntent({ kind: 'ping' })} /></div></div>
        </section>

        <section id="activity" className="desk-section activity-section" aria-labelledby="activity-title"><div className="desk-title"><span className="section-icon"><Icon name="history" size={24} /></span><div><h2 id="activity-title">Transaction log</h2><p>Everything sent from this console, saved in this browser.</p></div><span className="section-number" aria-hidden="true">04</span></div>
          {txLog.storageError && <Notice>Browser storage is unavailable. This log will last only for this visit. Save your transaction hashes.</Notice>}
          {!txLog.transactions.length ? <div className="log-empty"><Icon name="history" size={28} /><div><strong>A clean slate.</strong><p>Your first transaction will appear here with its Sepolia Etherscan link.</p></div><a className="text-link" href="#sqk">Try a ping<Icon name="arrow" size={16} /></a></div> : <ol className="transaction-list">{txLog.transactions.map(tx => <li key={tx.hash}><div className="tx-line"><strong>{tx.title}</strong><span className={`tx-status ${tx.status.toLowerCase()}`}><Icon name={tx.status === 'Confirmed' ? 'check' : tx.status === 'Reverted' ? 'close' : 'history'} size={14} />{tx.status}</span><time className="small-copy muted" dateTime={new Date(tx.at).toISOString()}>{date(tx.at)}</time></div><a className="hash-link" href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">{tx.hash}<Icon name="external" size={14} /></a><div className="tx-account small-copy muted">From <AddressLink address={tx.account} /> · Sepolia</div></li>)}</ol>}
          {txLog.transactions.some(tx => tx.status === 'Pending') && <p className="small-copy muted">Pending receipts are checked every 15 seconds. If a transaction was replaced or dropped, check its wallet history or Etherscan.</p>}
        </section>

        <details className="contract-details"><summary><Icon name="shield" size={18} /><span>Connected to the real thing</span><span className="small-copy muted">Contracts & data sources</span></summary><div className="contract-content"><p>Sepolia testnet · Chain ID 11155111. Every transaction targets the pinned contracts below.</p><dl>{Object.entries(CONTRACTS).map(([name, address]) => <div key={name}><dt>{({ core: 'SqueekCore', token: 'SQK token', nft: 'Genesis Squeeks', mining: 'SqueekMining proxy', staking: 'Staking proxy' } as Record<string, string>)[name]}</dt><dd><AddressLink address={address} full /></dd></div>)}</dl><p><a href="https://api.squeekchain.com/v1/status" target="_blank" rel="noreferrer">Wheel status API</a> · <a href="https://api.squeekchain.com/v1/economy/state" target="_blank" rel="noreferrer">Economy state API</a> · <a href="https://ethereum-sepolia-rpc.publicnode.com" target="_blank" rel="noreferrer">Sepolia RPC</a></p><p className="muted small-copy">Contract reads drive transaction availability. API telemetry refreshes every 15 seconds; wheel RPM cannot be recovered from the chain. Leaderboard refreshes every two minutes and counts transaction senders, not individual event stretches.</p>{live.economy.isError && <Notice>Economy API: {errorMessage(live.economy.error)} Using the pinned contracts directly.</Notice>}{live.status.isError && <Notice>Wheel telemetry is unavailable. Onchain block progress remains available when RPC reads succeed.</Notice>}</div></details>
      </main>
      <footer className="site-footer"><a className="footer-brand" href="#"><Hamster small />Small paws. Shared progress.</a><span>Built for Squeekchain · Sepolia only</span><a href="https://docs.squeekchain.com/" target="_blank" rel="noreferrer">Protocol docs<Icon name="external" size={14} /></a></footer>
    </div>
    <div className="sr-only" role="status">{refreshMessage}</div>
    {intent && <ReviewTransaction intent={intent} onClose={() => setIntent(undefined)} onSent={tx => txLog.add(tx)} />}
  </>
}
