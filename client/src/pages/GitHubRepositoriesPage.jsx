import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ExternalLink, GitBranch, LockKeyhole, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { analyzeGitHubRepositoryStack, getGitHubRepositories } from '../api/github.js'
import { signInWithGitHub } from '../api/auth.js'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Modal, Select, Table } from '../components/ui.jsx'

function formatUpdatedAt(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export default function GitHubRepositoriesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [repositories, setRepositories] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [projectType, setProjectType] = useState('')
  const [typeModalOpen, setTypeModalOpen] = useState(false)
  const [stackAnalysis, setStackAnalysis] = useState(null)
  const [stackStatus, setStackStatus] = useState('idle')
  const stackRequestId = useRef(0)
  const selectedRepositoryId = searchParams.get('repo')
  const selectedRepository = repositories.find((repository) => String(repository.id) === selectedRepositoryId)
  const retry = () => {
    setError(null)
    setStatus('loading')
    setRefreshKey((key) => key + 1)
  }
  const selectRepository = (repository) => {
    const requestId = stackRequestId.current + 1
    stackRequestId.current = requestId
    setProjectType('')
    setStackAnalysis(null)
    setStackStatus('loading')
    setSearchParams({ repo: String(repository.id) })
    setTypeModalOpen(true)
    analyzeGitHubRepositoryStack(repository.id, repository.defaultBranch).then((analysis) => {
      if (stackRequestId.current !== requestId) return
      setStackAnalysis(analysis)
      setProjectType(analysis.projectType || '')
      setStackStatus('success')
    }).catch(() => {
      if (stackRequestId.current !== requestId) return
      setStackStatus('error')
    })
  }

  const closeTypeModal = () => {
    stackRequestId.current += 1
    setTypeModalOpen(false)
  }

  useEffect(() => {
    let active = true

    getGitHubRepositories().then((items) => {
      if (!active) return
      setRepositories(items)
      setStatus('success')
    }).catch((requestError) => {
      if (!active) return
      setError(requestError)
      setStatus('error')
    })

    return () => { active = false }
  }, [refreshKey])

  const filteredRepositories = useMemo(() => repositories.filter((repository) => {
    const matchesSearch = `${repository.fullName} ${repository.description || ''} ${repository.language || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesVisibility = visibility === 'all' || (visibility === 'private' ? repository.private : !repository.private)
    return matchesSearch && matchesVisibility
  }), [repositories, search, visibility])

  const columns = [
    {
      key: 'repository',
      label: 'REPOSITORY',
      render: (repository) => <div className="repo-cell">
        <span className="repo-avatar">{repository.owner?.avatarUrl ? <img src={repository.owner.avatarUrl} alt="" referrerPolicy="no-referrer" /> : repository.name.slice(0, 2).toUpperCase()}</span>
        <span className="repo-meta"><strong>{repository.fullName}</strong><small>{repository.description || 'No description'}</small></span>
      </div>,
    },
    {
      key: 'visibility',
      label: 'VISIBILITY',
      render: (repository) => <Badge><>{repository.private && <LockKeyhole size={10} />}{repository.private ? 'Private' : 'Public'}</></Badge>,
    },
    { key: 'language', label: 'LANGUAGE', render: (repository) => repository.language || '-' },
    { key: 'defaultBranch', label: 'DEFAULT BRANCH', render: (repository) => <span className="branch"><GitBranch size={12} />{repository.defaultBranch || '-'}</span> },
    { key: 'updatedAt', label: 'UPDATED', render: (repository) => <span className="time-cell">{formatUpdatedAt(repository.updatedAt)}</span> },
    {
      key: 'open',
      label: '',
      render: (repository) => <a className="repo-open" href={repository.htmlUrl} target="_blank" rel="noreferrer" aria-label={`Open ${repository.fullName} on GitHub`} title="Open on GitHub"><ExternalLink size={14} /></a>,
    },
    {
      key: 'select',
      label: '',
      render: (repository) => {
        const selected = String(repository.id) === selectedRepositoryId
        return <Button size="small" variant={selected ? 'primary' : 'default'} aria-pressed={selected} onClick={() => selectRepository(repository)}>
          {selected && <Check size={12} />}{selected ? 'Selected' : 'Select'}
        </Button>
      },
    },
  ]

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">GitHub</p><h1>Select a repository</h1><p>Choose a repository from your GitHub account to connect to DeployHub.</p></div>
      <div className="heading-actions"><Button variant="ghost" onClick={() => navigate('/projects')}><ArrowLeft size={14} />Back to projects</Button></div>
    </div>

    <div className="repo-toolbar">
      <label className="search-box repo-search">
        <Search size={14} />
        <input aria-label="Search repositories" placeholder="Search repositories..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <Select value={visibility} onChange={(event) => setVisibility(event.target.value)} aria-label="Filter repository visibility">
        <option value="all">All repositories</option>
        <option value="private">Private</option>
        <option value="public">Public</option>
      </Select>
      <Badge>{filteredRepositories.length} {filteredRepositories.length === 1 ? 'repository' : 'repositories'}</Badge>
      {status === 'success' && <Button size="small" onClick={retry}>Refresh</Button>}
    </div>

    {status === 'loading' && <Card><LoadingState label="Fetching repositories from GitHub..." /></Card>}
    {status === 'error' && <Card>
      <ErrorState title="Could not load repositories" message={error?.message || 'GitHub repository data is unavailable.'} onRetry={retry} />
      {(error?.code === 'GITHUB_ACCESS_REQUIRED' || error?.code === 'GITHUB_REPOSITORIES_FAILED') && <div className="repo-reconnect"><Button variant="primary" onClick={signInWithGitHub}>Reconnect GitHub</Button></div>}
    </Card>}
    {status === 'success' && repositories.length === 0 && <Card><EmptyState title="No repositories found" message="This GitHub account does not have any repositories available to DeployHub." /></Card>}
    {status === 'success' && selectedRepositoryId && !selectedRepository && <Card><EmptyState title="Repository unavailable" message="This repository is not available to your GitHub account." action={<Button variant="ghost" onClick={() => setSearchParams({})}>Choose another repository</Button>} /></Card>}
    {status === 'success' && repositories.length > 0 && <Card className="table-card">
      <Table rows={filteredRepositories} columns={columns} empty="No repositories match your search and visibility filters." />
    </Card>}
    {status === 'success' && selectedRepository && <div className="repo-selection" role="status">
      <span className="repo-selection-icon"><Check size={14} /></span>
      <div><strong>{selectedRepository.fullName}</strong><small>Repository selected</small></div>
      <Button variant="ghost" size="small" onClick={() => { stackRequestId.current += 1; setProjectType(''); setStackAnalysis(null); setStackStatus('idle'); setTypeModalOpen(false); setSearchParams({}) }}>Clear selection</Button>
    </div>}
    <Modal open={typeModalOpen && Boolean(selectedRepository)} title="Choose a service type" onClose={closeTypeModal} footer={<><Button variant="ghost" onClick={closeTypeModal}>Cancel</Button><Button variant="primary" disabled={!projectType || stackStatus === 'loading'} onClick={() => {
      closeTypeModal()
      navigate(`/projects/new/configure?repo=${encodeURIComponent(selectedRepository.id)}&type=${encodeURIComponent(projectType)}`)
    }}>Continue</Button></>}>
      <p className="service-type-intro">{selectedRepository?.fullName}</p>
      <p className="service-type-intro" role="status" aria-live="polite">
        {stackStatus === 'loading' && 'Detecting framework from package.json...'}
        {stackStatus === 'success' && (stackAnalysis.detected
          ? `Detected ${stackAnalysis.framework}. Suggested service: ${stackAnalysis.projectType}.`
          : 'No supported root package.json framework detected; choose the service manually.')}
        {stackStatus === 'error' && 'Stack detection is unavailable; choose the service type manually.'}
      </p>
      <div className="project-type-options" role="radiogroup" aria-label="Project type">
        {['frontend', 'backend'].map((type) => <label className={`project-type-option${projectType === type ? ' selected' : ''}`} key={type}>
          <input type="radio" name="projectType" value={type} checked={projectType === type} disabled={stackStatus === 'loading'} onChange={() => setProjectType(type)} />
          <span><strong>{type === 'frontend' ? 'Frontend' : 'Backend'}</strong><small>{type === 'frontend' ? 'Web interface or static site' : 'Server-side application or API'}</small></span>
        </label>)}
      </div>
    </Modal>
  </>
}