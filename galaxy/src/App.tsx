import { useCallback, useEffect, useMemo, useState } from 'react'
import GalaxyApp from './GalaxyApp'
import LoginPage from './LoginPage'
import MarketingLanding from './MarketingLanding'

type Route = '/' | '/login' | '/app'

interface SessionState {
  status: 'checking' | 'authenticated' | 'guest' | 'error'
  configured: boolean
  actor: string | null
  expiresAt: string | null
  message: string
}

function normalizeRoute(pathname: string): Route {
  if (pathname === '/app' || pathname.startsWith('/app/')) return '/app'
  if (pathname === '/login') return '/login'
  return '/'
}

async function fetchSession(): Promise<SessionState> {
  const response = await fetch('/api/oracle/session', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Session check failed: HTTP ${response.status}`)
  }

  const payload = await response.json() as {
    configured?: boolean
    authenticated?: boolean
    actor?: string | null
    expiresAt?: string | null
    message?: string
  }

  return {
    status: payload.authenticated ? 'authenticated' : 'guest',
    configured: Boolean(payload.configured),
    actor: payload.actor ?? null,
    expiresAt: payload.expiresAt ?? null,
    message: payload.message ?? '',
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => normalizeRoute(window.location.pathname))
  const [session, setSession] = useState<SessionState>({
    status: 'checking',
    configured: false,
    actor: null,
    expiresAt: null,
    message: '',
  })

  useEffect(() => {
    const onPopState = () => setRoute(normalizeRoute(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((nextRoute: Route) => {
    if (normalizeRoute(window.location.pathname) !== nextRoute) {
      window.history.pushState({}, '', nextRoute)
    }
    setRoute(nextRoute)
  }, [])

  useEffect(() => {
    let alive = true
    fetchSession()
      .then((next) => {
        if (alive) setSession(next)
      })
      .catch((error: Error) => {
        if (alive) {
          setSession({
            status: 'error',
            configured: false,
            actor: null,
            expiresAt: null,
            message: error.message,
          })
        }
      })

    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (route === '/login' && session.status === 'authenticated') {
      navigate('/app')
    }
  }, [navigate, route, session.status])

  const authMessage = useMemo(() => {
    if (session.status === 'checking') return 'Checking Mike-only session before showing private access controls.'
    if (session.status === 'authenticated') return 'Session verified. Redirecting to Moshe Galaxy Admin...'
    if (session.status === 'error') return session.message || 'Session API is unavailable. Private access remains locked.'
    if (!session.configured) return 'Login is not configured on this deployment. Private access remains locked.'
    return 'Enter the Mike-only passphrase to open the private command center.'
  }, [session])

  if (route === '/') {
    return (
      <MarketingLanding
        onLogin={() => navigate(session.status === 'authenticated' ? '/app' : '/login')}
      />
    )
  }

  if (route === '/login') {
    return (
      <LoginPage
        initialMessage={authMessage}
        session={session}
        onAuthenticated={(nextSession) => {
          setSession(nextSession)
          navigate('/app')
        }}
        onBack={() => navigate('/')}
      />
    )
  }

  if (session.status === 'checking') {
    return (
      <div className="moshe-auth-status" role="status" aria-live="polite">
        <p>Private access</p>
        <strong>Moshe Galaxy Admin</strong>
        <span>Checking Mike-only session...</span>
      </div>
    )
  }

  if (session.status !== 'authenticated') {
    return (
      <LoginPage
        initialMessage={authMessage || 'Log in to open the Moshe Galaxy.'}
        session={session}
        onAuthenticated={(nextSession) => {
          setSession(nextSession)
          navigate('/app')
        }}
        onBack={() => navigate('/')}
      />
    )
  }

  return <GalaxyApp />
}
