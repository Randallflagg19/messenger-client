import { useEffect, useState } from 'react'
import type { Credentials } from '../api/greenApi'
import { runNotificationLoop } from '../api/notifications'
import type { IncomingText, ReceivingStatus } from '../api/notifications'

export function useNotifications(credentials: Credentials | null, onMessage: (incoming: IncomingText) => void) {
  const [status, setStatus] = useState<ReceivingStatus>({ kind: 'waiting' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!credentials) return
    const controller = new AbortController()
    void runNotificationLoop(credentials, controller.signal, onMessage, setStatus)
    return () => controller.abort()
  }, [credentials, onMessage, attempt])

  function retry() {
    setStatus({ kind: 'waiting' })
    setAttempt((previous) => previous + 1)
  }

  return { status, retry }
}
