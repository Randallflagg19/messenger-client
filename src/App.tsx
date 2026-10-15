import { useState } from 'react'
import type { Credentials } from './api/greenApi'
import { CredentialsForm } from './components/CredentialsForm'
import { Messenger } from './components/Messenger'

type Session = { mode: 'demo' } | { mode: 'live'; credentials: Credentials }

function App() {
  const [session, setSession] = useState<Session | null>(null)

  if (!session) {
    return <CredentialsForm
      onOpenDemo={() => setSession({ mode: 'demo' })}
      onConnected={(credentials) => setSession({ mode: 'live', credentials })}
    />
  }

  // При выходе Messenger удаляется вместе со всем состоянием переписок.
  return <Messenger
    credentials={session.mode === 'live' ? session.credentials : null}
    onExit={() => setSession(null)}
  />
}

export default App
