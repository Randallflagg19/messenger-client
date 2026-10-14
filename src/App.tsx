import { useState } from 'react'
import { chat as initialChat, messages as initialMessages } from './mockData'
import type { Chat, Message } from './types'
import styles from './App.module.css'
import { ChatList } from './components/ChatList'
import { ChatView } from './components/ChatView'
import { NewChatDialog } from './components/NewChatDialog'

function App() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [chats, setChats] = useState<Chat[]>([initialChat])
  const [selectedChatId, setSelectedChatId] = useState(initialChat.id)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const chat = chats.find((item) => item.id === selectedChatId) ?? initialChat
  const draft = drafts[chat.id] ?? ''
  const chatMessages = messages.filter((message) => message.chatId === chat.id)

  // На узком экране показываем либо список, либо переписку.
  const [isChatOpen, setIsChatOpen] = useState(true)

  function selectChat(id: string) {
    setSelectedChatId(id)
    setIsChatOpen(true)
  }

  function createChat(phoneNumber: string) {
    const existingChat = chats.find((item) => item.phoneNumber === phoneNumber)
    if (existingChat) {
      selectChat(existingChat.id)
    } else {
      const newChat: Chat = { id: crypto.randomUUID(), phoneNumber }
      setChats((previousChats) => [...previousChats, newChat])
      selectChat(newChat.id)
    }
    setIsNewChatOpen(false)
  }

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
    setDrafts((previousDrafts) => ({ ...previousDrafts, [chat.id]: '' }))
  }

  return (
    <main className={`${styles.layout} ${isChatOpen ? styles.chatOpen : ''}`}>
      <div className={styles.sidebar}>
        <ChatList
          chats={chats}
          messages={messages}
          selectedChatId={selectedChatId}
          onSelect={selectChat}
          onNewChat={() => setIsNewChatOpen(true)}
        />
      </div>
      <div className={styles.conversation}>
        <ChatView
          chat={chat}
          messages={chatMessages}
          draft={draft}
          isVisible={isChatOpen}
          onBack={() => setIsChatOpen(false)}
          onDraftChange={(text) => setDrafts((previous) => ({ ...previous, [chat.id]: text }))}
          onSend={sendMessage}
        />
      </div>
      {isNewChatOpen && <NewChatDialog onCreate={createChat} onClose={() => setIsNewChatOpen(false)} />}
    </main>
  )
}

export default App
