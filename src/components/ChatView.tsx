import { useEffect, useRef } from 'react'
import type { Chat, Message } from '../types'
import { getChatLabel } from '../utils'
import { MessageComposer } from './MessageComposer'
import styles from './ChatView.module.css'

type ChatViewProps = {
  chat: Chat
  messages: Message[]
  isSending: boolean
  sendDisabled: boolean
  sendError: string
  draft: string
  isVisible: boolean
  onBack: () => void
  onDraftChange: (text: string) => void
  onSend: () => void
}

export function ChatView({ chat, messages, isSending, sendDisabled, sendError, draft, isVisible, onBack, onDraftChange, onSend }: ChatViewProps) {
  const messagesRef = useRef<HTMLDivElement>(null)
  const scrollPosition = useRef({ chatId: '', nearBottom: true })
  const phoneLabel = getChatLabel(chat)
  const lastMessageId = messages.at(-1)?.id
  const lastDirection = messages.at(-1)?.direction

  useEffect(() => {
    const container = messagesRef.current
    if (!container) return
    if (scrollPosition.current.chatId !== chat.id || scrollPosition.current.nearBottom || lastDirection === 'outgoing') {
      container.scrollTop = container.scrollHeight
      scrollPosition.current.nearBottom = true
    }
    scrollPosition.current.chatId = chat.id
  }, [chat.id, lastMessageId, lastDirection, isVisible])

  return (
    <section className={styles.conversation} aria-label={`Переписка с ${phoneLabel}`}>
      <header className={styles.chatHeader}>
        <button className={styles.back} type="button" aria-label="Вернуться к списку чатов" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2>{phoneLabel}</h2>
      </header>
      <div ref={messagesRef} className={styles.messages} onScroll={(event) => {
        const container = event.currentTarget
        scrollPosition.current.nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80
      }}>
        {messages.length === 0 && <p className={styles.emptyChat}>Пока нет сообщений</p>}
        <div className={styles.messageStack}>
          {messages.map((message) => (
            <p key={message.id} className={styles[message.direction]}>{message.text}</p>
          ))}
        </div>
      </div>
      {sendError && <p role="alert" className={styles.sendError}>{sendError}</p>}
      <MessageComposer isSending={isSending} sendDisabled={sendDisabled} draft={draft} onDraftChange={onDraftChange} onSend={onSend} />
    </section>
  )
}
