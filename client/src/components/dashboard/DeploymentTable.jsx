import { GitBranch } from 'lucide-react'
import { StatusBadge, Table } from '../ui.jsx'

function formatAge(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function DeploymentTable({ deployments }) {
  const columns = [
    { key: 'projectName', label: 'PROJECT' },
    { key: 'commitSha', label: 'COMMIT', render: (row) => <span className="commit" title={row.commitSha || ''}>{row.commitSha?.slice(0, 10) || '-'}</span> },
    { key: 'branch', label: 'BRANCH', render: (row) => <span className="branch"><GitBranch size={12} />{row.branch}</span> },
    { key: 'status', label: 'STATUS', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', label: 'AGE', render: (row) => <span className="time-cell">{formatAge(row.createdAt)}</span> },
  ]

  return <Table rows={deployments} columns={columns} empty="Your project deployments will appear here." />
}