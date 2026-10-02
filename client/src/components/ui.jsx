import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, CircleAlert, Info, X } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Button({ children, variant = 'default', size = 'default', className = '', ...props }) {
  return <button className={`button ${variant === 'primary' ? 'button-primary' : ''} ${variant === 'ghost' ? 'button-ghost' : ''} ${variant === 'danger' ? 'button-danger' : ''} ${size === 'small' ? 'button-small' : ''} ${className}`} {...props}>{children}</button>
}
export function Input({ label, className = '', ...props }) {
  return <label className="input-wrap">{label && <span className="input-label">{label}</span>}<input className={`input ${className}`} {...props} /></label>
}
export function Select({ className = '', children, ...props }) {
  return <select className={`select ${className}`} {...props}>{children}</select>
}
export function Dropdown({ trigger, children, align = 'right', className = '' }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  useEffect(() => {
    const onPointerDown = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [])
  return <div className={`dropdown ${className}`} ref={root}>{typeof trigger === 'function' ? trigger({ open, toggle: () => setOpen(!open) }) : <button className="icon-button" onClick={() => setOpen(!open)} aria-expanded={open}>{trigger}</button>}{open && <div className="dropdown-panel" style={align === 'left' ? { right: 'auto', left: 0 } : undefined}>{children}</div>}</div>
}
export function DropdownItem({ children, onClick, icon: Icon, danger = false }) {
  return <button className="dropdown-item" style={danger ? { color: '#f28c93' } : undefined} onClick={onClick}>{Icon && <Icon size={14} />}{children}</button>
}
export function Modal({ open, title, children, onClose, footer }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
  if (!open) return null
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><h2>{title}</h2><Button variant="ghost" aria-label="Close dialog" onClick={onClose}><X size={15} /></Button></header><div className="modal-body">{children}</div>{footer && <footer className="modal-footer">{footer}</footer>}</section></div>
}
export function Toast({ message, onClose }) {
  useEffect(() => { if (!message) return undefined; const timer = window.setTimeout(onClose, 3200); return () => window.clearTimeout(timer) }, [message, onClose])
  if (!message) return null
  return <div className="toast" role="status"><Check size={15} />{message}<button className="icon-button" aria-label="Dismiss notification" onClick={onClose}><X size={13} /></button></div>
}
export function Badge({ children, tone = 'neutral', className = '' }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>
}
export function StatusBadge({ status }) {
  const normalized = String(status).toLowerCase()
  const tone = ['live', 'success', 'deployed', 'connected', 'active'].includes(normalized) ? 'success' : ['building', 'pending', 'warning', 'queued'].includes(normalized) ? 'warning' : ['failed', 'error', 'canceled'].includes(normalized) ? 'danger' : 'neutral'
  return <Badge tone={tone}><span className="status-dot" />{status}</Badge>
}
export function Card({ children, className = '', ...props }) {
  return <section className={`card ${className}`} {...props}>{children}</section>
}
export function Table({ columns, rows, rowKey = (row, index) => row.id ?? index, empty = 'No results found.' }) {
  return <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={rowKey(row, index)}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}</tr>) : <tr><td colSpan={columns.length}><EmptyState title="Nothing here yet" message={empty} /></td></tr>}</tbody></table></div>
}
export function Tabs({ tabs, value, onChange }) {
  return <div role="tablist" style={{ display: 'flex', gap: 4 }}>{tabs.map((tab) => <Button key={tab.value} role="tab" aria-selected={value === tab.value} variant={value === tab.value ? 'primary' : 'ghost'} size="small" onClick={() => onChange(tab.value)}>{tab.label}{tab.count != null && <span className="mono" style={{ opacity: .72 }}>{tab.count}</span>}</Button>)}</div>
}
export function Avatar({ initials = 'JD', src, alt = 'User avatar', className = '', ...props }) {
  return <span className={`avatar ${className}`} aria-label={alt} {...props}>{src ? <img src={src} alt={alt} referrerPolicy="no-referrer" /> : initials}</span>
}
export function Skeleton({ width = '100%', height = 12, style = {} }) {
  return <span className="skeleton" aria-hidden="true" style={{ display: 'block', width, height, ...style }} />
}
export function Breadcrumb({ items }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><ol>{items.map((item, index) => <li className="breadcrumb-item" key={item.label}>{index > 0 && <ChevronRight className="crumb-separator" size={12} />}{item.to && index !== items.length - 1 ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>
}
export function LoadingState({ label = 'Loading' }) {
  return <div className="state-box" role="status"><div style={{ display: 'grid', gap: 7, width: 180 }}><Skeleton height={9} /><Skeleton width="72%" height={9} /></div><p>{label}</p></div>
}
export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return <div className="state-box" role="alert"><span className="state-icon" style={{ color: '#f28c93' }}><CircleAlert size={16} /></span><h3>{title}</h3><p>{message}</p>{onRetry && <Button size="small" onClick={onRetry}>Try again</Button>}</div>
}
export function EmptyState({ title = 'No data yet', message = 'There is nothing to show here.', action }) {
  return <div className="state-box"><span className="state-icon"><Info size={15} /></span><h3>{title}</h3><p>{message}</p>{action}</div>
}