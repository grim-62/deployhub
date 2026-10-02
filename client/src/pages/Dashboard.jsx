import { useEffect, useState } from 'react'
import { Activity, Boxes, GitBranch, TriangleAlert } from 'lucide-react'
import { getDashboard } from '../api/dashboard.js'
import ActivityTimeline from '../components/dashboard/ActivityTimeline.jsx'
import DeploymentTable from '../components/dashboard/DeploymentTable.jsx'
import EmptyDashboard from '../components/dashboard/EmptyDashboard.jsx'
import StatsCard from '../components/dashboard/StatsCard.jsx'
import { Button, Card, ErrorState, Skeleton } from '../components/ui.jsx'
import { Link } from 'react-router-dom'

function DashboardSkeleton() {
  return (
    <>
      <div className="stats-grid">
        {[0, 1, 2, 3].map((item) => <Card className="stat-card" key={item}><Skeleton width="55%" height={9} /><Skeleton width="30%" height={22} style={{ marginTop: 16 }} /></Card>)}
      </div>
      <div className="dashboard-grid" style={{ marginTop: 20 }}>
        <Card className="table-card" style={{ padding: 16 }}>
          <Skeleton width="30%" height={12} style={{ marginBottom: 19 }} />
          {[0, 1, 2, 3].map((item) => <Skeleton height={34} key={item} style={{ marginTop: 8 }} />)}
        </Card>
        <Card style={{ padding: 16 }}>
          <Skeleton width="45%" height={12} style={{ marginBottom: 19 }} />
          {[0, 1, 2].map((item) => <Skeleton height={42} key={item} style={{ marginTop: 10 }} />)}
        </Card>
      </div>
    </>
  )
}

export default function Dashboard({ query = '' }) {
  const [requestId, setRequestId] = useState(0)
  const [state, setState] = useState({ loading: true, error: '', data: null })

  useEffect(() => {
    let active = true
    getDashboard().then((data) => {
      if (active) setState({ loading: false, error: '', data })
    }).catch((error) => {
      if (active) setState({ loading: false, error: error.message, data: null })
    })
    return () => { active = false }
  }, [requestId])

  const retry = () => {
    setState({ loading: true, error: '', data: null })
    setRequestId((value) => value + 1)
  }

  const heading = (
    <div className="page-heading">
      <div><p className="eyebrow">Workspace</p><h1>Overview</h1><p>Monitor your projects and deployments.</p></div>
      <div className="heading-actions"><Link to="/projects/new"><Button variant="primary">Add Project</Button></Link></div>
    </div>
  )

  if (state.loading) return <>{heading}<DashboardSkeleton /></>
  if (state.error) return <>{heading}<Card><ErrorState title="Dashboard unavailable" message={state.error} onRetry={retry} /></Card></>

  const { stats, recentDeployments, recentActivity } = state.data
  if (stats.projects === 0) return <>{heading}<EmptyDashboard /></>

  const search = query.trim().toLowerCase()
  const filteredDeployments = recentDeployments.filter((item) => `${item.projectName} ${item.commitSha} ${item.branch} ${item.status}`.toLowerCase().includes(search))
  const filteredActivity = recentActivity.filter((item) => `${item.message} ${item.projectName || ''} ${item.type}`.toLowerCase().includes(search))

  return (
    <>
      {heading}
      <div className="stats-grid">
        <StatsCard label="Projects" value={stats.projects} icon={Boxes} />
        <StatsCard label="Deployments" value={stats.deployments} icon={GitBranch} />
        <StatsCard label="Successful" value={stats.successful} icon={Activity} tone="success" />
        <StatsCard label="Failed" value={stats.failed} icon={TriangleAlert} tone="danger" />
      </div>
      <div className="dashboard-grid dashboard-data-grid">
        <section>
          <div className="section-title-row"><h2>Recent deployments</h2><Link to="/deployments" className="section-link">All deployments <span aria-hidden="true">›</span></Link></div>
          <Card className="table-card"><DeploymentTable deployments={filteredDeployments} /></Card>
        </section>
        <section>
          <div className="section-title-row"><h2>Recent activity</h2><Link to="/activity" className="section-link">View activity <span aria-hidden="true">›</span></Link></div>
          <Card className="activity-card"><ActivityTimeline activities={filteredActivity} /></Card>
        </section>
      </div>
    </>
  )
}