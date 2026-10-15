import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { getStateInstance, describeInstanceState } from '../api/greenApi'
import { messengerConfig } from '../config'
import styles from './CredentialsForm.module.css'

type CredentialsFormProps = {
  onOpenDemo: () => void
}

type ConnectionStatus =
  | { kind: 'idle' | 'loading' | 'success' }
  | { kind: 'error'; message: string }

export function CredentialsForm({ onOpenDemo }: CredentialsFormProps) {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>({ kind: 'idle' })
  const isLoading = status.kind === 'loading'
  const error = status.kind === 'error' ? status.message : ''

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) return
    if (!/^\d+$/.test(idInstance.trim())) {
      setStatus({ kind: 'error', message: 'Введите idInstance: только цифры.' })
      return
    }
    if (!apiTokenInstance.trim()) {
      setStatus({ kind: 'error', message: 'Введите apiTokenInstance.' })
      return
    }
    setStatus({ kind: 'loading' })
    const result = await getStateInstance({ idInstance, apiTokenInstance })
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.message })
    } else if (result.state === 'authorized') {
      setStatus({ kind: 'success' })
    } else {
      setStatus({ kind: 'error', message: describeInstanceState(result.state) })
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="credentials-title">
        <h1 id="credentials-title">Messenger Client</h1>
        <p className={styles.description}>Текстовые сообщения в {messengerConfig.name} через GREEN-API</p>
        <form onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
          <label htmlFor="instance-id">idInstance</label>
          <input
            id="instance-id"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="ID инстанса"
            disabled={isLoading}
            value={idInstance}
            onChange={(event) => {
              setIdInstance(event.currentTarget.value)
              setStatus({ kind: 'idle' })
            }}
            aria-describedby={error ? 'credentials-error' : undefined}
          />
          <label htmlFor="instance-token">apiTokenInstance</label>
          <input
            id="instance-token"
            type="password"
            autoComplete="off"
            placeholder="Токен инстанса"
            disabled={isLoading}
            value={apiTokenInstance}
            onChange={(event) => {
              setApiTokenInstance(event.currentTarget.value)
              setStatus({ kind: 'idle' })
            }}
            aria-describedby={error ? 'credentials-error' : undefined}
          />
          <p className={styles.notice}>Проверим состояние инстанса {messengerConfig.name}. Данные используются только для запроса и не сохраняются приложением в браузерном хранилище.</p>
          {error && <p id="credentials-error" className={styles.error} role="alert">{error}</p>}
          {status.kind === 'success' && (
            <p className={styles.success} role="status">Проверка успешна: инстанс авторизован. Отправка и получение реальных сообщений ещё не подключены.</p>
          )}
          {isLoading && <p className={styles.notice} role="status">Проверяем подключение…</p>}
          <button className={styles.connect} type="submit" disabled={isLoading}>
            {isLoading ? 'Подключение…' : 'Подключиться'}
          </button>
        </form>
        <button className={styles.demo} type="button" disabled={isLoading} onClick={onOpenDemo}>Открыть демо</button>
        <p className={styles.footnote}>В демо сообщения остаются в браузере и исчезают после перезагрузки.</p>
      </section>
    </main>
  )
}
