import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getAdminLiveProjects } from '../api/admin.js'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Table } from '../components/ui.jsx'

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    getAdminLiveProjects().then((rows) => {
      if (!active) return
      setProjects(rows)
      setError('')
      setLoading(false)
    }).catch((requestError) => {
      if (!active) return
      setError(requestError.message)
      setLoading(false)
    })
    return () => { active = false }
  }, [attempt])

  const refresh = () => {
    setLoading(true)
    setAttempt((value) => value + 1)
  }

  const columns = [
    { key: 'name', label: 'PROJECT', render: (project) => <Link to={`/admin/projects/${project.id}`}>{project.name}</Link> },
    { key: 'ownerGithubUsername', label: 'OWNER', render: (project) => `@${project.ownerGithubUsername}` },
    { key: 'repositoryFullName', label: 'REPOSITORY', render: (project) => project.repositoryFullName || '-' },
    { key: 'branch', label: 'BRANCH', render: (project) => project.branch || '-' },
    { key: 'productionUrl', label: 'LIVE URL', render: (project) => project.productionUrl ? <a href={project.productionUrl} target="_blank" rel="noreferrer">Open app <ExternalLink size={12} /></a> : '-' },
    { key: 'updatedAt', label: 'UPDATED', render: (project) => formatDate(project.updatedAt) },
    { key: 'status', label: 'STATUS', render: (project) => <Badge tone="success">{project.status}</Badge> },
  ]

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Administration</p><h1>Live projects</h1><p>Live projects across all DeployHub users.</p></div>
      <div className="heading-actions"><Button variant="ghost" onClick={refresh} disabled={loading} aria-label="Refresh live projects"><RefreshCw size={14} />Refresh</Button><Badge>{projects.length} live</Badge></div>
    </div>
    {loading && <Card><LoadingState label="Loading live projects..." /></Card>}
    {!loading && error && <Card><ErrorState title="Admin projects unavailable" message={error} onRetry={refresh} /></Card>}
    {!loading && !error && projects.length === 0 && <Card><EmptyState title="No live projects" message="No projects are currently live across user accounts." /></Card>}
    {!loading && !error && projects.length > 0 && <Card className="table-card"><Table rows={projects} columns={columns} empty="No live projects." /></Card>}
  </>
}