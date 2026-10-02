import { useEffect, useState } from 'react'

export function useRemoteCollection(load) {
  const [state, setState] = useState({ loading: true, error: '', items: [] })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    load().then((items) => {
      if (active) setState({ loading: false, error: '', items })
    }).catch((error) => {
      if (active) setState({ loading: false, error: error.message, items: [] })
    })
    return () => { active = false }
  }, [load, attempt])

  const retry = () => {
    setState({ loading: true, error: '', items: [] })
    setAttempt((value) => value + 1)
  }

  return { ...state, retry }
}