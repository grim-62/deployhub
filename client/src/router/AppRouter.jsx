import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorState, LoadingState, Toast } from '../components/ui.jsx'
import { AuthProvider } from '../features/auth/AuthContext.jsx'
import { useAuth } from '../features/auth/useAuth.js'
import { useApiHealth } from '../hooks/useApiHealth.js'
import AppLayout from '../layouts/AppLayout.jsx'
import { ActivityPage, DeploymentsPage, LoginPage, ProjectsPage, SettingsPage } from '../pages/Pages.jsx'
import GitHubRepositoriesPage from '../pages/GitHubRepositoriesPage.jsx'
import ProjectConfigurationPage from '../pages/ProjectConfigurationPage.jsx'
import ProjectDetailsPage from '../pages/ProjectDetailsPage.jsx'
import DeploymentDetailsPage from '../pages/DeploymentDetailsPage.jsx'
import Dashboard from '../pages/Dashboard.jsx'

function SessionGate({ guestOnly = false, children }) {
  const { status, error, retry } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <main className="auth-screen-state"><LoadingState label="Checking your DeployHub session..." /></main>
  if (status === 'error') return <main className="auth-screen-state"><ErrorState title="Unable to verify your session" message={error} onRetry={retry} /></main>
  if (guestOnly && status === 'authenticated') return <Navigate to="/dashboard" replace />
  if (!guestOnly && status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

function ApplicationRoutes() {
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const health = useApiHealth()
  const notify = (message) => setToast(message)
  const page = (content) => <SessionGate><AppLayout health={health} query={query} onQueryChange={setQuery} onNotify={notify}>{content}</AppLayout></SessionGate>
  return <><Routes>
    <Route path="/login" element={<SessionGate guestOnly><LoginPage /></SessionGate>} />
    <Route path="/dashboard" element={page(<Dashboard query={query} />)} />
    <Route path="/projects" element={page(<ProjectsPage query={query} />)} />
    <Route path="/projects/new" element={page(<GitHubRepositoriesPage />)} />
    <Route path="/projects/new/configure" element={page(<ProjectConfigurationPage onNotify={notify} />)} />
    <Route path="/projects/:id" element={page(<ProjectDetailsPage onNotify={notify} />)} />
    <Route path="/deployments/:id" element={page(<DeploymentDetailsPage />)} />
    <Route path="/deployments" element={page(<DeploymentsPage query={query} />)} />
    <Route path="/activity" element={page(<ActivityPage query={query} />)} />
    <Route path="/settings" element={page(<SettingsPage />)} />
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes><Toast message={toast} onClose={() => setToast('')} /></>
}

export default function AppRouter() {
  return <BrowserRouter><AuthProvider><ApplicationRoutes /></AuthProvider></BrowserRouter>
}