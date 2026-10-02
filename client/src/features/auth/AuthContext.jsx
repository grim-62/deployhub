import { useCallback, useEffect, useState } from 'react'
import { endSession, getCurrentUser } from '../../api/auth.js'
import { ApiError } from '../../api/client.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [attempt, setAttempt] = useState(0)
  const [session, setSession] = useState({ status: 'loading', user: null, error: '' })

  useEffect(() => {
    let active = true
    getCurrentUser().then((user) => {
      if (active) setSession({ status: 'authenticated', user, error: '' })
    }).catch((error) => {
      if (!active) return
      if (error instanceof ApiError && error.status === 401) {
        setSession({ status: 'anonymous', user: null, error: '' })
      } else {
        setSession({ status: 'error', user: null, error: error.message })
      }
    })
    return () => { active = false }
  }, [attempt])

  const retry = useCallback(() => {
    setSession({ status: 'loading', user: null, error: '' })
    setAttempt((value) => value + 1)
  }, [])

  const logout = useCallback(async () => {
    try {
      await endSession()
    } finally {
      setSession({ status: 'anonymous', user: null, error: '' })
    }
  }, [])

  return <AuthContext.Provider value={{ ...session, retry, logout }}>{children}</AuthContext.Provider>
}