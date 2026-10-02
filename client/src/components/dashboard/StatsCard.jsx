import { Card } from '../ui.jsx'

export default function StatsCard({ label, value, icon: Icon, tone = 'primary' }) {
  return (
    <Card className="stat-card">
      <div className="stat-label">
        <span>{label}</span>
        <span className={`stat-icon stat-icon-${tone}`}><Icon size={13} /></span>
      </div>
      <div className="stat-value-row">
        <span className="stat-value">{value}</span>
      </div>
    </Card>
  )
}