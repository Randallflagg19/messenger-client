import type { Chat, Message } from './types'

export const chat: Chat = {
  id: 'chat-1',
  phoneNumber: '79001234567',
}

export const messages: Message[] = [
  {
    id: 'message-1',
    chatId: chat.id,
    text: 'Привет! Во сколько встречаемся?',
    direction: 'incoming',
  },
  {
    id: 'message-2',
    chatId: chat.id,
    text: 'Привет! Давай в 18:00, как договаривались.',
    direction: 'outgoing',
  },
  {
    id: 'message-3',
    chatId: chat.id,
    text: 'Отлично, до встречи!',
    direction: 'incoming',
  },
]
