import { useEffect, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { normalizePhoneNumber } from '../utils'
import { messengerConfig } from '../config'
import styles from './NewChatDialog.module.css'

type NewChatDialogProps = {
  isDemo: boolean
  onCreate: (phoneNumber: string) => Promise<string | null>
  onClose: () => void
}

export function NewChatDialog({ isDemo, onCreate, onClose }: NewChatDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isCreating) return
    const phoneNumber = normalizePhoneNumber(phone)
    if (!phoneNumber) {
      setError('Введите номер с кодом страны: от 7 до 15 цифр. Например, +7 900 123-45-67.')
      return
    }
    setIsCreating(true)
    const createError = await onCreate(phoneNumber)
    if (createError) {
      setError(createError)
      setIsCreating(false)
    }
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="new-chat-title" onCancel={(event) => { if (isCreating) event.preventDefault(); else onClose() }}>
      <form onSubmit={handleSubmit} noValidate>
        <h2 id="new-chat-title">Новый чат</h2>
        <label htmlFor="phone-number">Номер телефона</label>
        <input
          id="phone-number"
          type="tel"
          autoComplete="tel"
          placeholder="+7 900 123-45-67"
          disabled={isCreating}
          value={phone}
          onChange={(event) => {
            setPhone(event.currentTarget.value)
            setError('')
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'phone-error' : 'phone-hint'}
        />
        <p id="phone-hint" className={styles.hint}>Российский номер можно ввести через 8 или +7. {isDemo ? 'В демо чат создаётся локально.' : `Проверим аккаунт ${messengerConfig.name} по номеру.`}</p>
        {error && <p id="phone-error" className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button type="button" disabled={isCreating} onClick={onClose}>Отмена</button>
          <button type="submit" disabled={isCreating} className={styles.create}>{isCreating ? 'Проверка…' : 'Создать'}</button>
        </div>
      </form>
    </dialog>
  )
}
