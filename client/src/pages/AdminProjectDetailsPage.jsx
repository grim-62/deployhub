import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteAdminProject, getAdminProject } from '../api/admin.js'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Modal, StatusBadge, Table } from '../components/ui.jsx'

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function AdminProjectDetailsPage({ onNotify }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true
    getAdminProject(id).then((data) => {
      if (!active) return
      setDetails(data)
      setError('')
      setLoading(false)
    }).catch((requestError) => {
      if (!active) return
      setError(requestError.message)
      setLoading(false)
    })
    return () => { active = false }
  }, [id, attempt])

  const retry = () => {
    setLoading(true)
    setAttempt((value) => value + 1)
  }

  const removeProject = async () => {
    if (!details || deleting) return
    setDeleting(true)
    try {
      const result = await deleteAdminProject(details.project.id)
      onNotify(result.cleanupPending ? 'Project deleted; runtime cleanup needs attention.' : 'Project deleted.')
      navigate('/admin/projects', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  const project = details?.project
  const deploymentColumns = [
    { key: 'id', label: 'DEPLOYMENT' },
    { key: 'branch', label: 'BRANCH' },
    { key: 'commitSha', label: 'COMMIT', render: (deployment) => deployment.commitSha?.slice(0, 7) || '-' },
    { key: 'status', label: 'STATUS', render: (deployment) => <StatusBadge status={deployment.status} /> },
    { key: 'createdAt', label: 'CREATED', render: (deployment) => formatDate(deployment.createdAt) },
  ]

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Admin / Live project</p><h1>{loading ? 'Loading project...' : project?.name || 'Project details'}</h1><p>Cross-account project details and deployment history.</p></div>
      <div className="heading-actions"><Link to="/admin/projects"><Button variant="ghost"><ArrowLeft size={14} />Live projects</Button></Link>{project && <Button variant="danger" onClick={() => setConfirmOpen(true)}><Trash2 size={14} />Delete project</Button>}</div>
    </div>
    {loading && <Card><LoadingState label="Loading project details..." /></Card>}
    {!loading && error && <Card><ErrorState title="Project details unavailable" message={error} onRetry={retry} /></Card>}
    {!loading && !error && !details && <Card><EmptyState title="Project not found" message="This live project may have been deleted or changed status." /></Card>}
    {!loading && !error && details && <>
      <Card className="project-details-card">
        <div className="project-details-title"><div><span className="eyebrow">Project status</span><StatusBadge status={project.status} /></div><Badge>{project.projectType}</Badge></div>
        <dl className="project-details-list">
          <div><dt>Owner</dt><dd>@{project.ownerGithubUsername}</dd></div>
          <div><dt>GitHub repository</dt><dd>{project.repositoryFullName || '-'}</dd></div>
          <div><dt>Branch</dt><dd>{project.branch || '-'}</dd></div>
          <div><dt>Production URL</dt><dd>{project.productionUrl ? <a href={project.productionUrl} target="_blank" rel="noreferrer">{project.productionUrl}<ExternalLink size={12} /></a> : '-'}</dd></div>
          <div><dt>Created</dt><dd>{formatDate(project.createdAt)}</dd></div>
          <div><dt>Updated</dt><dd>{formatDate(project.updatedAt)}</dd></div>
        </dl>
      </Card>
      <Card className="table-card">
        <div className="card-header"><div><h3>Recent deployments</h3><p>Latest {details.deployments.length} deployments</p></div></div>
        {details.deployments.length ? <Table rows={details.deployments} columns={deploymentColumns} /> : <EmptyState title="No deployment history" />}
      </Card>
    </>}
    <Modal open={confirmOpen} title="Delete this live project?" onClose={() => { if (!deleting) setConfirmOpen(false) }} footer={<>
      <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
      <Button variant="danger" onClick={removeProject} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete permanently'}</Button>
    </>}>
      <p>This permanently deletes <strong>{project?.name}</strong>, its deployment history, and its live runtime resources. This action cannot be undone.</p>
    </Modal>
  </>
}