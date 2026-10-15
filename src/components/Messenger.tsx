import { useCallback, useState } from 'react'
import { messengerConfig } from '../config'
import { chat as initialChat, messages as initialMessages } from '../mockData'
import type { Chat, Message } from '../types'
import styles from './Messenger.module.css'
import { ChatList } from './ChatList'
import { ChatView } from './ChatView'
import { NewChatDialog } from './NewChatDialog'
import type { Credentials } from '../api/greenApi'
import { checkAccount, sendTextMessage, MAX_MESSAGE_LENGTH } from '../api/greenApi'

import { useNotifications } from '../hooks/useNotifications'
import type { IncomingText } from '../api/notifications'

type MessengerProps = { credentials: Credentials | null; onExit: () => void }

export function Messenger({ credentials, onExit }: MessengerProps) {
  const isDemo = credentials === null
  const [messages, setMessages] = useState<Message[]>(isDemo ? initialMessages : [])
  const [chats, setChats] = useState<Chat[]>(isDemo ? [initialChat] : [])
  const [selectedChatId, setSelectedChatId] = useState(isDemo ? initialChat.id : '')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const [sendingChatId, setSendingChatId] = useState<string | null>(null)
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({})
  const chat = chats.find((item) => item.id === selectedChatId)
  const draft = chat ? drafts[chat.id] ?? '' : ''
  const chatMessages = messages.filter((message) => message.chatId === chat?.id)

  // На узком экране показываем либо список, либо переписку.
  const [isChatOpen, setIsChatOpen] = useState(isDemo)

  const receiveMessage = useCallback(({ chat: incomingChat, message }: IncomingText) => {
    setChats((previous) => previous.some((item) => item.id === incomingChat.id)
      ? previous : [...previous, incomingChat])
    setMessages((previous) => previous.some((item) => item.id === message.id && item.chatId === message.chatId)
      ? previous : [...previous, message])
  }, [])
  const { status: receiving, retry: retryReceiving } = useNotifications(credentials, receiveMessage)

  function selectChat(id: string) {
    setSelectedChatId(id)
    setIsChatOpen(true)
  }

  async function createChat(phoneNumber: string): Promise<string | null> {
    const existingChat = chats.find((item) => item.phoneNumber === phoneNumber)
    if (existingChat) {
      selectChat(existingChat.id)
    } else {
      let id: string = crypto.randomUUID()
      if (credentials) {
        const result = await checkAccount(credentials, phoneNumber)
        if (!result.ok) return result.message
        id = result.chatId
      }
      const newChat: Chat = { id, phoneNumber }
      setChats((previousChats) => previousChats.some((item) => item.id === id)
        ? previousChats.map((item) => item.id === id ? { ...item, phoneNumber } : item)
        : [...previousChats, newChat])
      selectChat(id)
    }
    setIsNewChatOpen(false)
    return null
  }

  async function sendMessage() {
    if (!chat || !draft.trim() || draft.length > MAX_MESSAGE_LENGTH || sendingChatId) return
    // Фиксируем получателя и текст до запроса: пользователь может сменить чат.
    const chatId = chat.id
    const text = draft
    setSendingChatId(chatId)
    setSendErrors((previous) => ({ ...previous, [chatId]: '' }))
    let id: string = crypto.randomUUID()
    if (credentials) {
      const result = await sendTextMessage(credentials, chatId, text)
      if (!result.ok) {
        setSendErrors((previous) => ({ ...previous, [chatId]: result.message }))
        setSendingChatId(null)
        return
      }
      id = result.idMessage
    }
    const message: Message = { id, chatId, text, direction: 'outgoing' }
    setMessages((previous) => previous.some((item) => item.id === id && item.chatId === chatId) ? previous : [...previous, message])
    // Не стираем новый черновик, если его изменили во время запроса.
    setDrafts((previous) => previous[chatId] === text ? { ...previous, [chatId]: '' } : previous)
    setSendingChatId(null)
  }

  return (
    <main className={`${styles.layout} ${isChatOpen ? styles.chatOpen : ''}`}>
      <header className={styles.demoBanner}>
        <span>{isDemo ? `Демо · Сообщения не отправляются в ${messengerConfig.name}` : `${messengerConfig.name} · ${receiving.kind === 'waiting' ? 'Ожидание сообщений' : 'Получение приостановлено'}`}</span>
        {!isDemo && receiving.kind !== 'waiting' && (
          <span role="status" className={styles.receivingError}>
            {receiving.message}
            {receiving.kind === 'stopped' && <button type="button" onClick={retryReceiving}>Возобновить</button>}
          </span>
        )}
        <button type="button" onClick={onExit}>Выйти</button>
      </header>
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
        {chat ? <ChatView
          chat={chat}
          messages={chatMessages}
          draft={draft}
          isSending={sendingChatId === chat.id}
          sendDisabled={sendingChatId !== null}
          sendError={sendErrors[chat.id] ?? ''}
          isDemo={isDemo}
          isVisible={isChatOpen}
          onBack={() => setIsChatOpen(false)}
          onDraftChange={(text) => setDrafts((previous) => ({ ...previous, [chat.id]: text }))}
          onSend={sendMessage}
        /> : <div className={styles.emptySelection}>Выберите чат или создайте новый</div>}
      </div>
      {isNewChatOpen && <NewChatDialog isDemo={isDemo} onCreate={createChat} onClose={() => setIsNewChatOpen(false)} />}
    </main>
  )
}
