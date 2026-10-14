import { useEffect, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { normalizePhoneNumber } from '../utils'
import styles from './NewChatDialog.module.css'

type NewChatDialogProps = {
  onCreate: (phoneNumber: string) => void
  onClose: () => void
}

export function NewChatDialog({ onCreate, onClose }: NewChatDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const phoneNumber = normalizePhoneNumber(phone)
    if (!phoneNumber) {
      setError('Введите номер с кодом страны: от 7 до 15 цифр. Например, +7 900 123-45-67.')
      return
    }
    onCreate(phoneNumber)
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="new-chat-title" onCancel={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <h2 id="new-chat-title">Новый чат</h2>
        <label htmlFor="phone-number">Номер телефона</label>
        <input
          id="phone-number"
          type="tel"
          autoComplete="tel"
          placeholder="+7 900 123-45-67"
          value={phone}
          onChange={(event) => {
            setPhone(event.currentTarget.value)
            setError('')
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'phone-error' : 'phone-hint'}
        />
        <p id="phone-hint" className={styles.hint}>Российский номер можно ввести через 8 или +7. Чат создаётся локально, без проверки аккаунта Telegram.</p>
        {error && <p id="phone-error" className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button type="button" onClick={onClose}>Отмена</button>
          <button type="submit" className={styles.create}>Создать</button>
        </div>
      </form>
    </dialog>
  )
}
