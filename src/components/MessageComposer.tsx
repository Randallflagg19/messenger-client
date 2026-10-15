import { useEffect, useLayoutEffect, useRef } from 'react'
import { MAX_MESSAGE_LENGTH } from '../api/greenApi'
import { resizeComposer } from '../utils'
import styles from './MessageComposer.module.css'

type MessageComposerProps = {
  isSending: boolean
  sendDisabled: boolean
  draft: string
  onDraftChange: (text: string) => void
  onSend: () => void
}

export function MessageComposer({ isSending, sendDisabled, draft, onDraftChange, onSend }: MessageComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (inputRef.current) resizeComposer(inputRef.current)
  }, [draft])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    // Пересчитываем переносы при изменении ширины и возвращении из списка чатов.
    let previousWidth = -1
    const observer = new ResizeObserver(() => {
      if (input.clientWidth === previousWidth) return
      previousWidth = input.clientWidth
      if (previousWidth > 0) resizeComposer(input)
    })
    observer.observe(input)
    return () => observer.disconnect()
  }, [])

  function handleSend() {
    if (!draft.trim() || sendDisabled || draft.length > MAX_MESSAGE_LENGTH) return
    onSend()
    inputRef.current?.focus()
  }

  return (
    <div className={styles.composer}>
      <textarea
        ref={inputRef}
        className={styles.input}
        aria-label="Текст сообщения"
        placeholder="Написать сообщение…"
        rows={1}
        maxLength={MAX_MESSAGE_LENGTH}
        readOnly={isSending}
        aria-busy={isSending}
        value={draft}
        onChange={(event) => onDraftChange(event.currentTarget.value)}
      />
      <button className={styles.send} type="button" disabled={!draft.trim() || sendDisabled || draft.length > MAX_MESSAGE_LENGTH} onClick={handleSend}>
        {isSending ? 'Отправка…' : 'Отправить'}
      </button>
    </div>
  )
}
