import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { chat, messages as initialMessages } from './mockData'
import type { Message } from './types'
import { formatPhoneNumber, resizeComposer } from './utils'
import styles from './App.module.css'

function App() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const phoneLabel = formatPhoneNumber(chat.phoneNumber)
  const chatMessages = messages.filter((message) => message.chatId === chat.id)
  const lastMessage = chatMessages.at(-1)

  // Пока это только переключение экранов каркаса на узком экране.
  const [isChatOpen, setIsChatOpen] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (inputRef.current) resizeComposer(inputRef.current)
  }, [draft])

  useEffect(() => {
    const container = messagesRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [messages, isChatOpen])

  function sendMessage() {
    if (!draft.trim()) return

    const message: Message = {
      id: crypto.randomUUID(),
      chatId: chat.id,
      text: draft,
      direction: 'outgoing',
    }

    // Пока добавляем сообщение только в локальное состояние.
    setMessages((previousMessages) => [...previousMessages, message])
    setDraft('')
    inputRef.current?.focus()
  }

  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    // При изменении ширины окна меняются и переносы строк.
    let previousWidth = -1
    const observer = new ResizeObserver(() => {
      if (input.clientWidth === previousWidth) return
      previousWidth = input.clientWidth
      if (previousWidth > 0) resizeComposer(input)
    })
    observer.observe(input)
    return () => observer.disconnect()
  }, [])

  return (
    <main className={`${styles.layout} ${isChatOpen ? styles.chatOpen : ''}`}>
      <aside className={styles.sidebar} aria-label="Список чатов">
        <header className={styles.sidebarHeader}>
          <h1>Чаты</h1>
          <button className={styles.newChat} type="button" disabled>
            Новый чат
          </button>
        </header>

        <nav className={styles.chatList} aria-label="Чаты">
          <button
            className={styles.chatItem}
            type="button"
            aria-current={isChatOpen ? 'true' : undefined}
            onClick={() => setIsChatOpen(true)}
          >
            <span className={styles.phone}>{phoneLabel}</span>
            <span className={styles.preview}>{lastMessage?.text ?? 'Нет сообщений'}</span>
          </button>
        </nav>

      </aside>

      <section className={styles.conversation} aria-label={`Переписка с ${phoneLabel}`}>
        <header className={styles.chatHeader}>
          <button
            className={styles.back}
            type="button"
            aria-label="Вернуться к списку чатов"
            onClick={() => setIsChatOpen(false)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2>{phoneLabel}</h2>
        </header>

        <div ref={messagesRef} className={styles.messages}>
          <div className={styles.messageStack}>
            {chatMessages.map((message) => (
              <p key={message.id} className={styles[message.direction]}>
                {message.text}
              </p>
            ))}
          </div>
        </div>

        <div className={styles.composer}>
          <textarea
            ref={inputRef}
            className={styles.input}
            aria-label="Текст сообщения"
            placeholder="Написать сообщение…"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
          />
          <button
            className={styles.send}
            type="button"
            disabled={!draft.trim()}
            onClick={sendMessage}
          >
            Отправить
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
