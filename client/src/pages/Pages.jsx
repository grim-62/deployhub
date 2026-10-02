import { useMemo, useState } from 'react'
import { Activity, ArrowUpRight, Box, Code2, GitBranch, LoaderCircle, Plus, Rocket, TriangleAlert } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signInWithGitHub } from '../api/auth.js'
import { getActivity, getDeployments, getProjects } from '../api/workspace.js'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Select, StatusBadge, Table } from '../components/ui.jsx'
import { useRemoteCollection } from '../hooks/useRemoteCollection.js'

const activityIcons = {
  deployment_succeeded: Rocket,
  deployment_failed: TriangleAlert,
  deployment_started: GitBranch,
  project_created: Box,
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function PageHeading({ eyebrow, title, description, children }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{children && <div className="heading-actions">{children}</div>}</div>
}
function ProjectTable({ rows, empty }) {
  const columns = [
    { key: 'name', label: 'PROJECT', render: (row) => <Link className="project-cell project-link" to={`/projects/${row.id}`}><span className="project-avatar">{row.name.slice(0, 2).toUpperCase()}</span><span className="project-meta"><strong>{row.name}</strong><small>{row.repositoryFullName || '-'}</small></span></Link> },
    { key: 'projectType', label: 'TYPE', render: (row) => row.projectType ? row.projectType[0].toUpperCase() + row.projectType.slice(1) : '-' },
    { key: 'status', label: 'STATUS', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', label: 'CREATED', render: (row) => <span className="time-cell">{formatDate(row.createdAt)}</span> },
  ]
  return <Table rows={rows} columns={columns} empty={empty} />
}
function DeploymentTable({ rows }) {
  const columns = [
    { key: 'id', label: 'DEPLOYMENT' },
    { key: 'projectName', label: 'PROJECT' },
    { key: 'branch', label: 'BRANCH', render: (row) => <span className="branch"><GitBranch size={12} />{row.branch}</span> },
    { key: 'status', label: 'STATUS', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'commitSha', label: 'COMMIT', render: (row) => <span className="commit" title={row.commitSha}>{row.commitSha?.slice(0, 10) || '-'}</span> },
    { key: 'createdAt', label: 'CREATED', render: (row) => <span className="time-cell">{formatDate(row.createdAt)}</span> },
  ]
  return <Table rows={rows} columns={columns} empty="No deployments match the selected filters." />
}
export function ProjectsPage({ query }) {
  const navigate = useNavigate()
  const { items: projects, loading, error, retry } = useRemoteCollection(getProjects)
  const [filter, setFilter] = useState('all')
  const statuses = [...new Set(projects.map((project) => project.status).filter(Boolean))]
  const rows = useMemo(() => projects.filter((project) => `${project.name} ${project.repositoryFullName || ''} ${project.framework || ''} ${project.status}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || project.status === filter)), [projects, query, filter])
  return <><PageHeading eyebrow="Workspace" title="Projects" description="Manage your applications and their production environments."><Button variant="primary" onClick={() => navigate('/projects/new')}><Plus size={14} />Add Project</Button></PageHeading>{loading ? <Card><LoadingState label="Loading projects..." /></Card> : error ? <Card><ErrorState title="Projects unavailable" message={error} onRetry={retry} /></Card> : projects.length === 0 ? <Card><EmptyState title="No projects yet" message="Add a GitHub repository to create your first project." action={<Button variant="primary" onClick={() => navigate('/projects/new')}><Plus size={14} />Add Project</Button>} /></Card> : <><div className="list-toolbar"><Select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter projects"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</Select><Badge>{rows.length} {rows.length === 1 ? 'project' : 'projects'}</Badge></div><Card className="table-card"><ProjectTable rows={rows} empty="No projects match the current search and status." /></Card></>}</>
}
export function DeploymentsPage({ query }) {
  const { items: deployments, loading, error, retry } = useRemoteCollection(getDeployments)
  const [status, setStatus] = useState('all')
  const statuses = [...new Set(deployments.map((deployment) => deployment.status).filter(Boolean))]
  const rows = useMemo(() => deployments.filter((item) => `${item.id} ${item.projectName} ${item.branch} ${item.commitSha}`.toLowerCase().includes(query.toLowerCase()) && (status === 'all' || item.status === status)), [deployments, query, status])
  return <><PageHeading eyebrow="Workspace" title="Deployments" description="Monitor builds and releases across every project." />{loading ? <Card><LoadingState label="Loading deployments..." /></Card> : error ? <Card><ErrorState title="Deployments unavailable" message={error} onRetry={retry} /></Card> : deployments.length === 0 ? <Card><EmptyState title="No deployments yet" message="Deployment records will appear here when a project is deployed." /></Card> : <><div className="list-toolbar"><Select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter deployments by status"><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</Select><Badge>{rows.length} {rows.length === 1 ? 'deployment' : 'deployments'}</Badge></div><Card className="table-card"><DeploymentTable rows={rows} /></Card></>}</>
}
export function ActivityPage({ query }) {
  const { items: activity, loading, error, retry } = useRemoteCollection(getActivity)
  const entries = activity.filter((item) => `${item.type} ${item.message} ${item.projectName || ''}`.toLowerCase().includes(query.toLowerCase()))
  return <><PageHeading eyebrow="Workspace" title="Activity" description="A timeline of changes and events across your workspace." />{loading ? <Card><LoadingState label="Loading activity..." /></Card> : error ? <Card><ErrorState title="Activity unavailable" message={error} onRetry={retry} /></Card> : entries.length === 0 ? <Card><EmptyState title={activity.length ? 'No matching activity' : 'No activity yet'} message={activity.length ? 'No activity matches the current search.' : 'Project and deployment events will appear here when recorded.'} /></Card> : <div className="timeline">{entries.map((item) => { const Icon = activityIcons[item.type] || Activity; return <article className="timeline-item" key={item.id}><span className="timeline-icon"><Icon size={13} /></span><div className="timeline-body"><h3>{item.type.replaceAll('_', ' ')}</h3><p>{item.message}{item.projectName && <> · {item.projectName}</>}</p><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></div></article> })}</div>}</>
}
export function SettingsPage() {
  return <><PageHeading eyebrow="Workspace" title="Settings" description="Workspace preferences." /><Card><EmptyState title="Settings are not configured" message="Workspace settings will appear here when they are connected to a data source." /></Card></>
}
export function LoginPage() {
  const [searchParams] = useSearchParams()
  const [authenticating, setAuthenticating] = useState(false)
  const errorMessages = {
    github_not_configured: 'GitHub sign-in is not configured on this server yet.',
    github_cancelled: 'GitHub authorization was cancelled.',
    oauth_state_invalid: 'We could not verify this sign-in request. Please try again.',
    oauth_failed: 'GitHub sign-in could not be completed. Please try again.',
  }
  const authError = errorMessages[searchParams.get('error')]
  const startSignIn = () => {
    setAuthenticating(true)
    signInWithGitHub()
  }
  return <main className="login-screen"><section className="login-story"><Link to="/login" className="brand"><span className="brand-mark"><Code2 size={17} /></span><span>DeployHub</span></Link><div className="login-copy"><h1>Ship better.<br /><span>Stay in flow.</span></h1><p>Your deployment workspace, made clear. Bring projects, releases, and your team into one calm view.</p></div><div className="login-footer">© 2026 DeployHub. Deployment infrastructure, without the noise.</div></section><section className="login-panel"><div className="login-form"><h2>Welcome to DeployHub</h2><p>Deploy your GitHub projects to your infrastructure.</p>{authError && <div className="login-auth-error" role="alert"><TriangleAlert size={15} />{authError}</div>}<Button type="button" variant="primary" className="github-login-button" onClick={startSignIn} disabled={authenticating} aria-busy={authenticating}>{authenticating ? <LoaderCircle size={15} className="auth-spinner" /> : <GitBranch size={15} />}{authenticating ? 'Connecting to GitHub...' : 'Continue with GitHub'}{!authenticating && <ArrowUpRight size={14} />}</Button></div></section></main>
}