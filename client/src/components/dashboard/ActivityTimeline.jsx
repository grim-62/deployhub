import { Activity, Box, GitBranch, Rocket, TriangleAlert } from 'lucide-react'
import { EmptyState } from '../ui.jsx'

const icons = {
  deployment_succeeded: Rocket,
  deployment_failed: TriangleAlert,
  deployment_started: GitBranch,
  project_created: Box,
}

function formatAge(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  return `${Math.floor(hours / 24)} days ago`
}

export default function ActivityTimeline({ activities }) {
  if (!activities.length) return <EmptyState title="No recent activity" message="Project and deployment events will show up here." />

  return (
    <div className="activity-list">
      {activities.map((item) => {
        const Icon = icons[item.type] || Activity
        const failed = item.type === 'deployment_failed'
        return (
          <article className="activity-item" key={item.id}>
            <span className="activity-marker" style={failed ? { color: '#f28c93', background: '#302126' } : undefined}>
              <Icon size={12} />
            </span>
            <div className="activity-copy">
              <p><strong>{item.message}</strong></p>
              {item.projectName && <p>{item.projectName}</p>}
              <small>{formatAge(item.createdAt)}</small>
            </div>
          </article>
        )
      })}
    </div>
  )
}