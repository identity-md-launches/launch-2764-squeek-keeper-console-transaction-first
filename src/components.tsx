import { useEffect, useRef, type ReactNode } from 'react'
import { EXPLORER } from './chain'
import { short } from './format'

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
    external: <><path d="M14 4h6v6m-1-5-9 9" /><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    wallet: <><path d="M20 8H5a2 2 0 0 1 0-4h13v4M5 8a2 2 0 0 1-2-2v13a1 1 0 0 0 1 1h16V8Z" /><path d="M20 12h-5v4h5m-3-2h.1" /></>,
    sprout: <><path d="M12 21V11M4 4c0 7 8 9 8 9S13 4 4 4Zm16 2c-7 0-8 7-8 7s8 0 8-7Z" /></>,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 5v6h6m3-4v5l3 2" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    wheel: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="m6 6 5 5m2 2 5 5M6 18l5-5m2-2 5-5" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    coin: <><circle cx="12" cy="12" r="9" /><path d="M15 8h-5a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8m4-10v12" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.info}</svg>
}

export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close(); trigger?.focus() }
  }, [])
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); if (!busy) close.current() }} onClick={event => { if (event.target === ref.current && !busy) close.current() }}>
    <div className="modal-inner">
      <div className="modal-head"><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><Icon name="close" /></button></div>
      {children}
    </div>
  </dialog>
}

export function AddressLink({ address, full = false }: { address: string; full?: boolean }) {
  const label = full ? address : short(address)
  return <a className={full ? 'address full-address' : 'address'} href={`${EXPLORER}/address/${address}`} target="_blank" rel="noreferrer" aria-label={`${label} on Sepolia Etherscan. Full address ${address}`} title={address}>{label}<Icon name="external" size={14} /></a>
}

export function Action({ label, reason, onClick, primary = false }: { label: string; reason?: string; onClick: () => void; primary?: boolean }) {
  const id = `reason-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  return <div className="action"><button type="button" className={`button ${primary ? 'primary' : 'secondary'}`} disabled={Boolean(reason)} aria-describedby={reason ? id : undefined} onClick={onClick}>{label}<Icon name="arrow" size={18} /></button>{reason && <p className="action-reason" id={id}>{reason}</p>}</div>
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : undefined}><Icon name="info" size={18} /><div>{children}</div></div>
}

export function Hamster({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'hamster small' : 'hamster'} viewBox="0 0 32 28" shapeRendering="crispEdges" aria-hidden="true">
    <path fill="#73452f" d="M5 2h7v3h8V2h7v10h3v11h-4v3H6v-3H2V12h3Z" />
    <path fill="#d89b57" d="M7 4h3v4h12V4h3v10h3v7h-4v3H8v-3H4v-7h3Z" />
    <path fill="#f2b6a0" d="M7 5h3v5H7zm15 0h3v5h-3Z" />
    <path fill="#fff3d7" d="M10 12h12v3h3v6h-3v3H10v-3H7v-6h3Z" />
    <path fill="#302e25" d="M9 11h3v3H9zm11 0h3v3h-3Zm-6 6h4v3h-4Zm-1 5h6v2h-6Z" />
    <path fill="#e9a58d" d="M6 16h4v3H6zm16 0h4v3h-4Z" />
  </svg>
}
