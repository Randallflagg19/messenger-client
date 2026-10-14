export type Chat = {
  id: string
  // Международный формат: код страны и номер, только цифры.
  phoneNumber: string
}

export type Message = {
  id: string
  // Ссылка на Chat.id — определяет, к какой переписке относится сообщение.
  chatId: string
  text: string
  direction: 'incoming' | 'outgoing'
}
