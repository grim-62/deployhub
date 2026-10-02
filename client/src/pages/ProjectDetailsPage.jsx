import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, GitBranch, Rocket } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getProject, queueProjectDeployment } from '../api/workspace.js'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/ui.jsx'

export default function ProjectDetailsPage({ onNotify }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState('')
  const [deployment, setDeployment] = useState(null)

  useEffect(() => {
    let active = true
    getProject(id).then((data) => {
      if (!active) return
      setProject(data)
      setLoading(false)
      setError('')
    }).catch((requestError) => {
      if (!active) return
      setError(requestError.message)
      setLoading(false)
    })
    return () => { active = false }
  }, [id, retryKey])

  const retry = () => {
    setLoading(true)
    setError('')
    setRetryKey((key) => key + 1)
  }

  const deploy = async () => {
    if (!project || deploying) return
    setDeploying(true)
    setDeployError('')
    try {
      const queuedDeployment = await queueProjectDeployment(project.id)
      setDeployment(queuedDeployment)
      setProject((current) => ({ ...current, status: queuedDeployment.status }))
      onNotify('Deployment queued.')
      navigate(`/deployments/${queuedDeployment.id}`)
    } catch (requestError) {
      setDeployError(requestError.message)
    } finally {
      setDeploying(false)
    }
  }

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Project</p><h1>{loading ? 'Loading project...' : project?.name || 'Project unavailable'}</h1><p>Project configuration and deployment status.</p></div>
      <div className="heading-actions"><Link to="/projects"><Button variant="ghost"><ArrowLeft size={14} />Projects</Button></Link></div>
    </div>
    {loading && <Card><LoadingState label="Loading project details..." /></Card>}
    {!loading && error && <Card><ErrorState title="Project unavailable" message={error} onRetry={retry} /></Card>}
    {!loading && !error && !project && <Card><EmptyState title="Project not found" message="This project may have been removed or belongs to another account." /></Card>}
    {!loading && !error && project && <>
      <Card className="project-details-card">
        <div className="project-details-title"><div><span className="eyebrow">Project status</span><StatusBadge status={project.status} /></div><Badge>{project.projectType ? project.projectType[0].toUpperCase() + project.projectType.slice(1) : 'Type unavailable'}</Badge></div>
        <dl className="project-details-list">
          <div><dt>GitHub repository</dt><dd>{project.repositoryFullName || '-'}</dd></div>
          <div><dt>Branch</dt><dd><span className="branch"><GitBranch size={12} />{project.branch || '-'}</span></dd></div>
          <div><dt>Production URL</dt><dd>{project.productionUrl ? <a href={project.productionUrl} target="_blank" rel="noreferrer">{project.productionUrl}<ExternalLink size={12} /></a> : '-'}</dd></div>
        </dl>
        {deployError && <p className="project-create-error" role="alert">{deployError}</p>}
        {deployment && <p className="deployment-queued-note" role="status">Deployment #{deployment.id} was queued.</p>}
        <div className="project-create-actions">
          <Button variant="primary" onClick={deploy} disabled={deploying || ['QUEUED', 'BUILDING', 'DEPLOYING'].includes(project.status)}>
            <Rocket size={14} />{deploying ? 'Queueing...' : project.status === 'QUEUED' ? 'Deployment queued' : 'Deploy Project'}
          </Button>
        </div>
      </Card>
    </>}
  </>
}