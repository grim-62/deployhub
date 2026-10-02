import { Boxes } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Card } from '../ui.jsx'

export default function EmptyDashboard() {
  return (
    <Card className="empty-dashboard">
      <span className="state-icon"><Boxes size={17} /></span>
      <h2>Your workspace is ready</h2>
      <p>Add a project to see deployments, activity, and health metrics here.</p>
      <Link to="/projects/new"><Button variant="primary">Add Project</Button></Link>
    </Card>
  )
}