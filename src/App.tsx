import { useEffect, useRef, useState } from 'react'
import styles from './App.module.css'

function resizeComposer(input: HTMLTextAreaElement) {
  // Сначала сбрасываем высоту, чтобы поле уменьшалось при удалении текста.
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight + 2}px`
}

function App() {
  // Пока это только переключение экранов каркаса на узком экране.
  const [isChatOpen, setIsChatOpen] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
            <span className={styles.phone}>+7 900 123-45-67</span>
            <span className={styles.preview}>Отлично, до встречи!</span>
          </button>
        </nav>

      </aside>

      <section className={styles.conversation} aria-label="Переписка с +7 900 123-45-67">
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
          <h2>+7 900 123-45-67</h2>
        </header>

        <div className={styles.messages}>
          <div className={styles.messageStack}>
            <p className={styles.incoming}>Привет! Во сколько встречаемся?</p>
            <p className={styles.outgoing}>Привет! Давай в 18:00, как договаривались.</p>
            <p className={styles.incoming}>Отлично, до встречи!</p>
          </div>
        </div>

        <div className={styles.composer}>
          <textarea
            ref={inputRef}
            className={styles.input}
            aria-label="Текст сообщения"
            placeholder="Написать сообщение…"
            rows={1}
            onInput={(event) => resizeComposer(event.currentTarget)}
          />
          <button className={styles.send} type="button" disabled>
            Отправить
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
