import { useCallback, useEffect, useState } from 'react'
import { fetchHealth } from '../api/health.js'

export function useApiHealth() {
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    fetchHealth().then((data) => { if (active) setState({ loading: false, error: '', data }) }).catch((error) => { if (active) setState({ loading: false, error: error.message, data: null }) })
    return () => { active = false }
  }, [attempt])
  const retry = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    setAttempt((value) => value + 1)
  }, [])
  return { ...state, retry }
}