import { useState } from 'react'
import type { SubmitEvent } from 'react'
import styles from './CredentialsForm.module.css'

type CredentialsFormProps = {
  onOpenDemo: () => void
}

export function CredentialsForm({ onOpenDemo }: CredentialsFormProps) {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    // Проверяем только заполнение формы. Запроса к GREEN-API пока нет.
    if (!/^\d+$/.test(idInstance.trim())) {
      setError('Введите idInstance: только цифры.')
      return
    }
    if (!apiTokenInstance.trim()) {
      setError('Введите apiTokenInstance.')
      return
    }
    setError('Подключение ещё не реализовано. Данные не проверены и не отправлены. Для просмотра интерфейса откройте демо.')
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="credentials-title">
        <h1 id="credentials-title">Messenger Client</h1>
        <p className={styles.description}>Текстовые сообщения в Telegram через GREEN-API</p>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="instance-id">idInstance</label>
          <input
            id="instance-id"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="ID инстанса"
            value={idInstance}
            onChange={(event) => {
              setIdInstance(event.currentTarget.value)
              setError('')
            }}
            aria-describedby={error ? 'credentials-error' : undefined}
          />
          <label htmlFor="instance-token">apiTokenInstance</label>
          <input
            id="instance-token"
            type="password"
            autoComplete="off"
            placeholder="Токен инстанса"
            value={apiTokenInstance}
            onChange={(event) => {
              setApiTokenInstance(event.currentTarget.value)
              setError('')
            }}
            aria-describedby={error ? 'credentials-error' : undefined}
          />
          <p className={styles.notice}>Подключение к GREEN-API пока недоступно в приложении. Можно посмотреть демо без учётных данных.</p>
          {error && <p id="credentials-error" className={styles.error} role="alert">{error}</p>}
          <button className={styles.connect} type="submit">Подключиться</button>
        </form>
        <button className={styles.demo} type="button" onClick={onOpenDemo}>Открыть демо</button>
        <p className={styles.footnote}>В демо сообщения остаются в браузере и исчезают после перезагрузки.</p>
      </section>
    </main>
  )
}
