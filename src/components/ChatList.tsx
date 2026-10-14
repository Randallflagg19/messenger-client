import type { Chat, Message } from '../types'
import { formatPhoneNumber } from '../utils'
import styles from './ChatList.module.css'

type ChatListProps = {
  chats: Chat[]
  messages: Message[]
  selectedChatId: string
  onSelect: (id: string) => void
  onNewChat: () => void
}

export function ChatList({ chats, messages, selectedChatId, onSelect, onNewChat }: ChatListProps) {
  return (
    <aside className={styles.sidebar} aria-label="Список чатов">
      <header className={styles.sidebarHeader}>
        <h1>Чаты</h1>
        <button className={styles.newChat} type="button" onClick={onNewChat}>Новый чат</button>
      </header>
      <nav className={styles.chatList} aria-label="Чаты">
        {chats.map((chat) => {
          const lastMessage = messages.filter((message) => message.chatId === chat.id).at(-1)
          return (
            <button
              key={chat.id}
              className={`${styles.chatItem} ${chat.id === selectedChatId ? styles.activeChat : ''}`}
              type="button"
              aria-current={chat.id === selectedChatId ? 'true' : undefined}
              onClick={() => onSelect(chat.id)}
            >
              <span className={styles.phone}>{formatPhoneNumber(chat.phoneNumber)}</span>
              <span className={styles.preview}>{lastMessage?.text ?? 'Нет сообщений'}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
