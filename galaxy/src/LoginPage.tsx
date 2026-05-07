import { FormEvent, useEffect, useState } from 'react'
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

export default function LoginPage({
  initialMessage,
  session,
  onAuthenticated,
  onBack,
}: LoginPageProps) {
  const [passphrase, setPassphrase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(initialMessage)

  useEffect(() => {
    setMessage(initialMessage)
  }, [initialMessage])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')

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
        throw new Error(payload.message || payload.error || 'Login failed.')
      }

      onAuthenticated({
        status: 'authenticated',
        configured: Boolean(payload.configured ?? true),
        actor: payload.actor ?? 'Mike',
        expiresAt: payload.expiresAt ?? null,
        message: payload.message ?? 'Oracle session unlocked.',
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <button className="login-back" type="button" onClick={onBack}>
          Back
        </button>
        <p className="login-kicker">Private access</p>
        <h1>Moshe Galaxy</h1>
        <p>
          Enter the Mike-only passphrase to open the Oracle dashboard and
          private galaxy interface.
        </p>

        <form onSubmit={submit}>
          <label htmlFor="moshe-passphrase">Passphrase</label>
          <input
            id="moshe-passphrase"
            autoComplete="current-password"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            disabled={submitting || session.status === 'checking'}
            required
          />
          <button type="submit" disabled={submitting || session.status === 'checking'}>
            {submitting ? 'Unlocking...' : 'Unlock Galaxy'}
          </button>
        </form>

        {message && <div className="login-message">{message}</div>}
      </section>
    </main>
  )
}
