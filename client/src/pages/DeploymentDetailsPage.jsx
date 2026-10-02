import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, GitBranch } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getDeployment, getDeploymentLogs } from '../api/workspace.js'
import { Button, Card, ErrorState, LoadingState, StatusBadge } from '../components/ui.jsx'
import { getProjectNavigationTarget } from '../utils/deploymentFlow.js'

const activeStatuses = new Set(['QUEUED', 'BUILDING', 'DEPLOYING'])

export default function DeploymentDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [deployment, setDeployment] = useState(null)
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let timer
    const refresh = async () => {
      try {
        const [nextDeployment, nextLogs] = await Promise.all([getDeployment(id), getDeploymentLogs(id)])
        if (!active) return
        setDeployment(nextDeployment)
        setLogs(nextLogs)
        setLoading(false)
        setError('')
        if (activeStatuses.has(nextDeployment.status)) timer = setTimeout(refresh, 2000)
      } catch (requestError) {
        if (!active) return
        setError(requestError.message)
        setLoading(false)
      }
    }
    void refresh()
    return () => { active = false; clearTimeout(timer) }
  }, [id, attempt])

  useEffect(() => {
    if (!deployment) return
    const projectRoute = getProjectNavigationTarget(deployment)
    if (projectRoute) {
      navigate(projectRoute, { replace: true })
    }
  }, [deployment, navigate])

  const retry = () => {
    setLoading(true)
    setError('')
    setAttempt((value) => value + 1)
  }

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Deployment</p><h1>{deployment ? `Deployment #${deployment.id}` : 'Deployment details'}</h1><p>Build and runtime status for this project.</p></div>
      <div className="heading-actions"><Link to={deployment ? `/projects/${deployment.projectId}` : '/projects'}><Button variant="ghost"><ArrowLeft size={14} />Project</Button></Link></div>
    </div>
    {loading && <Card><LoadingState label="Loading deployment status..." /></Card>}
    {!loading && error && <Card><ErrorState title="Deployment unavailable" message={error} onRetry={retry} /></Card>}
    {!loading && !error && deployment && <div className="deployment-detail-layout">
      <Card className="deployment-detail-card">
        <div className="deployment-detail-status"><span>Status</span><StatusBadge status={deployment.status} /></div>
        <dl className="project-details-list">
          <div><dt>Project</dt><dd><Link to={`/projects/${deployment.projectId}`}>{deployment.projectName}</Link></dd></div>
          <div><dt>Repository</dt><dd>{deployment.repositoryFullName || '-'}</dd></div>
          <div><dt>Branch</dt><dd><span className="branch"><GitBranch size={12} />{deployment.branch || '-'}</span></dd></div>
          <div><dt>Commit</dt><dd>{deployment.commitSha || '-'}</dd></div>
        </dl>
        {deployment.deploymentUrl && <div className="deployment-public-url"><div><span className="eyebrow">Production URL</span><a href={deployment.deploymentUrl} target="_blank" rel="noreferrer">{deployment.deploymentUrl}<ExternalLink size={12} /></a></div><div className="project-create-actions"><Button variant="primary" onClick={() => window.open(deployment.deploymentUrl, '_blank', 'noopener,noreferrer')}>Open Application</Button>{deployment.projectId && <Button variant="ghost" onClick={() => navigate(`/projects/${deployment.projectId}`)}>Manage Project</Button>}</div></div>}
      </Card>
      <Card className="deployment-logs-card">
        <div className="card-header"><div><h3>Deployment logs</h3><p>{activeStatuses.has(deployment.status) ? 'Updating automatically' : 'Final output'}</p></div></div>
        <pre className="deployment-logs">{logs || 'No deployment output yet.'}</pre>
      </Card>
    </div>}
  </>
}