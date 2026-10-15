export type Chat = {
  id: string
  // Международный формат: код страны и номер, только цифры.
  phoneNumber?: string
  name?: string
}

export type Message = {
  id: string
  chatId: string
  text: string
  direction: 'incoming' | 'outgoing'
}
