import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { analyzeGitHubRepositoryStack, getGitHubRepository } from '../api/github.js'
import { createProject, queueProjectDeployment } from '../api/workspace.js'
import { Badge, Button, Card, ErrorState, Input, LoadingState } from '../components/ui.jsx'

function formatCommitDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function ProjectConfigurationPage({ onNotify }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const repositoryId = searchParams.get('repo')
  const projectType = searchParams.get('type')
  const configurationIsValid = Boolean(repositoryId && ['frontend', 'backend'].includes(projectType))
  const [repository, setRepository] = useState(null)
  const [loading, setLoading] = useState(configurationIsValid)
  const [loadError, setLoadError] = useState(configurationIsValid ? '' : 'Select a GitHub repository and service type before configuring deployment.')
  const [branch, setBranch] = useState('')
  const [stackAnalysis, setStackAnalysis] = useState(null)
  const [stackStatus, setStackStatus] = useState(configurationIsValid ? 'loading' : 'idle')
  const [variables, setVariables] = useState([])
  const [nextVariableId, setNextVariableId] = useState(1)
  const [showValues, setShowValues] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [createdProjectId, setCreatedProjectId] = useState(null)

  useEffect(() => {
    let active = true
    if (!configurationIsValid) return () => { active = false }

    getGitHubRepository(repositoryId).then((data) => {
      if (!active) return
      setRepository(data)
      setBranch(data.defaultBranch || 'main')
      setLoading(false)
    }).catch((requestError) => {
      if (!active) return
      setLoadError(requestError.message)
      setLoading(false)
    })

    return () => { active = false }
  }, [configurationIsValid, repositoryId])

  useEffect(() => {
    if (!repository || !branch.trim()) return undefined
    let active = true
    const timer = setTimeout(() => {
      analyzeGitHubRepositoryStack(repository.id, branch.trim()).then((analysis) => {
        if (!active) return
        setStackAnalysis(analysis)
        setStackStatus('success')
      }).catch(() => {
        if (!active) return
        setStackStatus('error')
      })
    }, 300)

    return () => { active = false; clearTimeout(timer) }
  }, [repository, branch])

  const addVariable = () => {
    setVariables((current) => [...current, { id: nextVariableId, key: '', value: '' }])
    setNextVariableId((id) => id + 1)
  }

  const updateVariable = (id, field, value) => {
    setVariables((current) => current.map((variable) => variable.id === id ? { ...variable, [field]: value } : variable))
  }

  const deploy = async (event) => {
    event.preventDefault()
    if (!repository || submitting || createdProjectId) return
    setSubmitError('')

    const environmentVariables = {}
    for (const variable of variables) {
      const key = variable.key.trim()
      const value = variable.value
      if (!key && !value) continue
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || !value || /[\r\n\0]/.test(value)) {
        setSubmitError('Each variable needs a valid key and a single-line value.')
        return
      }
      if (Object.hasOwn(environmentVariables, key)) {
        setSubmitError(`The environment variable ${key} is listed more than once.`)
        return
      }
      environmentVariables[key] = value
    }

    setSubmitting(true)
    let project
    try {
      project = await createProject({
        githubRepoId: repository.id,
        projectType,
        branch: branch.trim(),
        environmentVariables,
      })
      setCreatedProjectId(project.id)
    } catch (requestError) {
      setSubmitError(requestError.message)
      setSubmitting(false)
      return
    }

    try {
      const deployment = await queueProjectDeployment(project.id)
      onNotify('Deployment queued.')
      navigate(`/deployments/${deployment.id}`)
    } catch (requestError) {
      setSubmitError(`Project saved, but deployment could not be queued: ${requestError.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Card><LoadingState label="Loading repository configuration..." /></Card>
  if (loadError) return <Card><ErrorState title="Configuration unavailable" message={loadError} onRetry={() => navigate('/projects/new')} /></Card>

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Pre-deployment configuration</p><h1>{repository.fullName}</h1><p>Review the branch and configure environment variables before deployment.</p></div>
      <div className="heading-actions"><Link to={`/projects/new?repo=${encodeURIComponent(repository.id)}`}><Button variant="ghost"><ArrowLeft size={14} />Change repository</Button></Link></div>
    </div>

    <form className="predeploy-layout" onSubmit={deploy}>
      <Card className="predeploy-card">
        <div className="predeploy-section-heading"><div><h2>Repository analysis</h2><p>{stackStatus === 'loading' ? 'Detecting framework and latest commit...' : `Branch: ${branch}`}</p></div>{stackAnalysis?.detected && <Badge>{stackAnalysis.framework}</Badge>}</div>
        {stackStatus === 'error' && <p role="status">Could not analyze this branch. You can still continue with the selected project type.</p>}
        {stackStatus === 'success' && <dl className="project-details-list">
          <div><dt>Detected stack</dt><dd>{stackAnalysis.detected ? stackAnalysis.framework : 'Not detected'}</dd></div>
          {stackAnalysis.projectType && <div><dt>Suggested service</dt><dd>{stackAnalysis.projectType === 'frontend' ? 'Frontend' : 'Backend'}{stackAnalysis.runtime === 'node' ? ' (Node.js runtime)' : ' (static site)'}</dd></div>}
          <div><dt>Latest commit</dt><dd>{stackAnalysis.latestCommit ? <>
            <a href={stackAnalysis.latestCommit.url || repository.htmlUrl} target="_blank" rel="noreferrer">{stackAnalysis.latestCommit.sha.slice(0, 7)}<ExternalLink size={12} /></a>
            <span>{stackAnalysis.latestCommit.message.split('\n')[0] || 'No commit message'}</span>
            <small>{stackAnalysis.latestCommit.author} - {formatCommitDate(stackAnalysis.latestCommit.date)}</small>
          </> : 'No commit found on this branch.'}</dd></div>
        </dl>}
      </Card>

      <Card className="predeploy-card">
        <div className="predeploy-section-heading"><div><h2>Project type</h2><p>Selected service runtime</p></div><Badge>{projectType === 'frontend' ? 'Frontend' : 'Backend'}</Badge></div>
        <div className="form-field"><label htmlFor="deploy-branch">Branch</label><Input id="deploy-branch" value={branch} onChange={(event) => { setBranch(event.target.value); setStackAnalysis(null); setStackStatus(event.target.value.trim() ? 'loading' : 'idle') }} required maxLength={255} pattern="[A-Za-z0-9._/-]+" title="Use letters, numbers, dots, underscores, slashes, or hyphens." /><small>The runner builds this branch from GitHub.</small></div>
      </Card>

      <Card className="predeploy-card">
        <div className="predeploy-section-heading"><div><h2>Environment variables</h2><p>Encrypted before they are stored.</p></div><div className="heading-actions"><Button type="button" variant="ghost" size="small" aria-label={showValues ? 'Hide values' : 'Show values'} onClick={() => setShowValues((visible) => !visible)}>{showValues ? <EyeOff size={14} /> : <Eye size={14} />}</Button><Button type="button" size="small" onClick={addVariable}><Plus size={13} />Add variable</Button></div></div>
        {variables.length === 0 && <p className="predeploy-empty-vars">No environment variables configured.</p>}
        <div className="environment-variable-list">
          {variables.map((variable) => <div className="environment-variable-row" key={variable.id}>
            <Input aria-label="Variable name" autoComplete="off" placeholder="VARIABLE_NAME" value={variable.key} onChange={(event) => updateVariable(variable.id, 'key', event.target.value)} />
            <Input aria-label="Variable value" autoComplete="new-password" type={showValues ? 'text' : 'password'} placeholder="Value" value={variable.value} onChange={(event) => updateVariable(variable.id, 'value', event.target.value)} />
            <Button type="button" variant="ghost" aria-label={`Remove ${variable.key || 'environment variable'}`} onClick={() => setVariables((current) => current.filter((item) => item.id !== variable.id))}><Trash2 size={14} /></Button>
          </div>)}
        </div>
      </Card>

      {submitError && <Card className="predeploy-error" role="alert">{submitError}{createdProjectId && <Link to={`/projects/${createdProjectId}`}><Button variant="ghost" size="small">Open saved project</Button></Link>}</Card>}
      <div className="predeploy-submit"><Button type="submit" variant="primary" disabled={submitting || Boolean(createdProjectId) || !branch.trim()}>{submitting ? 'Starting deployment...' : 'Deploy Project'}</Button></div>
    </form>
  </>
}