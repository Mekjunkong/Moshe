import { FormEvent, useEffect, useMemo, useState } from 'react'
import './LoginPage.css'

interface SessionState {
  status: 'checking' | 'authenticated' | 'guest' | 'error'
  configured: boolean
  actor: string | null
  expiresAt: string | null
  message: string
}

interface LoginPageProps {
  initialMessage: string
  session: SessionState
  onAuthenticated: (session: SessionState) => void
  onBack: () => void
}

type GateTone = 'info' | 'warning' | 'error' | 'success'

export default function LoginPage({
  initialMessage,
  session,
  onAuthenticated,
  onBack,
}: LoginPageProps) {
  const [passphrase, setPassphrase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(initialMessage)
  const [messageTone, setMessageTone] = useState<GateTone>(() => toneForSession(session))

  const gateState = useMemo(() => getGateState(session), [session])
  const canAttemptLogin = gateState === 'ready' && !submitting
  const showMessage = Boolean(message) && gateState !== 'unconfigured'

  useEffect(() => {
    setMessage(initialMessage)
    setMessageTone(toneForSession(session))
  }, [initialMessage, session])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canAttemptLogin) {
      setMessage(messageForUnavailableState(session))
      setMessageTone(toneForSession(session))
      return
    }

    setSubmitting(true)
    setMessage('Checking passphrase for Mike-only access...')
    setMessageTone('info')

    try {
      const response = await fetch('/api/oracle/session', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passphrase }),
      })
      const payload = await response.json() as {
        authenticated?: boolean
        configured?: boolean
        actor?: string | null
        expiresAt?: string | null
        message?: string
        error?: string
      }

      if (!response.ok || !payload.authenticated) {
        const fallback = response.status === 401
          ? 'Invalid passphrase. Mike-only access stays locked.'
          : 'Login failed. The private command center remains locked.'
        throw new Error(payload.message || payload.error || fallback)
      }

      setMessage('Session verified. Redirecting to Moshe Galaxy Admin...')
      setMessageTone('success')

      onAuthenticated({
        status: 'authenticated',
        configured: Boolean(payload.configured ?? true),
        actor: payload.actor ?? 'Mike',
        expiresAt: payload.expiresAt ?? null,
        message: payload.message ?? 'Oracle session unlocked.',
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid passphrase. Mike-only access stays locked.')
      setMessageTone('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <button className="login-back" type="button" onClick={onBack}>
          ← Back to main site
        </button>

        <div className="login-heading">
          <p className="login-kicker">Mike-only access</p>
          <h1 id="login-title">Moshe Galaxy Admin</h1>
          <p>
            Private command center for Mike Web Studio. Authorized access only,
            protected before the Oracle dashboard loads.
          </p>
        </div>

        {gateState === 'unconfigured' ? (
          <div
            className="login-config-state"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <span>Configuration required</span>
            <strong>Login is unavailable on this deployment.</strong>
            <p>
              The session secret is missing, so the passphrase gate is disabled
              instead of pretending it can unlock the private app.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} aria-describedby="passphrase-help login-message" aria-busy={submitting}>
            <label htmlFor="moshe-passphrase">Mike-only passphrase</label>
            <input
              id="moshe-passphrase"
              name="passphrase"
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              type="password"
              placeholder="Enter private passphrase"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              disabled={!canAttemptLogin}
              required
            />
            <p id="passphrase-help" className="login-helper">
              Passphrase stays masked. This gate opens only a verified private session.
            </p>
            <button type="submit" disabled={!canAttemptLogin}>
              {submitting ? 'Verifying session...' : 'Unlock private command center'}
            </button>
          </form>
        )}

        {showMessage && (
          <div
            id="login-message"
            className={`login-message login-message--${messageTone}`}
            role={messageTone === 'error' || messageTone === 'warning' ? 'alert' : 'status'}
            aria-live={messageTone === 'error' || messageTone === 'warning' ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            {message}
          </div>
        )}
      </section>
    </main>
  )
}

function getGateState(session: SessionState) {
  if (session.status === 'checking') return 'checking'
  if (session.status === 'authenticated') return 'authenticated'
  if (session.status === 'error') return 'error'
  if (!session.configured) return 'unconfigured'
  return 'ready'
}

function toneForSession(session: SessionState): GateTone {
  if (session.status === 'authenticated') return 'success'
  if (session.status === 'error' || !session.configured) return 'warning'
  return 'info'
}

function messageForUnavailableState(session: SessionState) {
  if (session.status === 'checking') return 'Checking Mike-only session before enabling the gate.'
  if (session.status === 'error') return session.message || 'Session API is unavailable. Private access remains locked.'
  if (!session.configured) return 'Login is not configured on this deployment. Private access remains locked.'
  return 'Private access is not ready yet.'
}
