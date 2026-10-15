import { receiveNotification, deleteNotification } from './greenApi.ts'
import type { ApiError, Credentials, QueueNotification } from './greenApi.ts'
import type { Chat, Message } from '../types.ts'

export type IncomingText = { chat: Chat; message: Message }
export type ReceivingStatus =
  | { kind: 'waiting' }
  | { kind: 'retrying' | 'stopped'; message: string }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// null — событие вне нашего объёма: статусы, исходящие, группы или вложения.
export function parseIncomingText(body: Record<string, unknown>): IncomingText | null {
  if (typeof body.typeWebhook !== 'string') throw new Error('Нет типа уведомления.')
  if (body.typeWebhook !== 'incomingMessageReceived') return null
  const sender = body.senderData
  const data = body.messageData
  if (!isObject(sender) || !isObject(data) || typeof sender.chatId !== 'string') {
    throw new Error('Некорректные данные входящего сообщения.')
  }
  if (sender.chatId.startsWith('-')) return null
  if (!/^[1-9]\d*$/.test(sender.chatId)) throw new Error('Некорректный идентификатор чата.')
  if (typeof data.typeMessage !== 'string') throw new Error('Нет типа сообщения.')
  let text: unknown
  if (data.typeMessage === 'textMessage') {
    text = isObject(data.textMessageData) ? data.textMessageData.textMessage : undefined
  } else if (data.typeMessage === 'extendedTextMessage') {
    text = isObject(data.extendedTextMessageData) ? data.extendedTextMessageData.text : undefined
  } else {
    return null
  }
  if (typeof text !== 'string' || typeof body.idMessage !== 'string' || !body.idMessage) {
    throw new Error('Некорректный текст или идентификатор сообщения.')
  }
  const phone = String(sender.senderPhoneNumber ?? '')
  const name = typeof sender.senderName === 'string' ? sender.senderName : undefined
  return {
    chat: {
      id: sender.chatId,
      phoneNumber: /^[1-9]\d{6,14}$/.test(phone) ? phone : undefined,
      name,
    },
    message: { id: body.idMessage, chatId: sender.chatId, text, direction: 'incoming' },
  }
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return }
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, milliseconds)
    signal.addEventListener('abort', finish, { once: true })
  })
}

// Последовательная обработка: receive → обработка → delete. Никакого setInterval.
export async function runNotificationLoop(
  credentials: Credentials,
  signal: AbortSignal,
  onMessage: (incoming: IncomingText) => void,
  onStatus: (status: ReceivingStatus) => void,
): Promise<void> {
  // Cleanup StrictMode успевает отменить пробный запуск до первого запроса.
  await Promise.resolve()
  let pending: QueueNotification | null = null
  let retryDelay = 2_000
  while (!signal.aborted) {
    let result: { ok: true; notification: QueueNotification | null } | ApiError
    if (pending) {
      const deleted = await deleteNotification(credentials, pending.receiptId, signal)
      result = deleted.ok ? { ok: true, notification: null } : deleted
    } else {
      result = await receiveNotification(credentials, signal)
    }
    if (signal.aborted) return
    if (!result.ok) {
      if (!result.retryable) {
        onStatus({ kind: 'stopped', message: result.message })
        return
      }
      onStatus({ kind: 'retrying', message: `${result.message} Повтор получения через ${retryDelay / 1000} с.` })
      await wait(retryDelay, signal)
      retryDelay = Math.min(retryDelay * 2, 30_000)
      continue
    }
    retryDelay = 2_000
    onStatus({ kind: 'waiting' })
    if (pending) {
      pending = null
      // Небольшая пауза защищает от частых запросов при накопившейся очереди.
      await wait(250, signal)
      continue
    }
    if (!result.notification) {
      await wait(500, signal)
      continue
    }
    const notification: QueueNotification = result.notification
    try {
      const incoming = parseIncomingText(notification.body)
      if (incoming) onMessage(incoming)
    } catch {
      onStatus({ kind: 'stopped', message: 'Не удалось обработать уведомление. Получение остановлено; уведомление оставлено в очереди.' })
      return
    }
    // Подтверждаем только после обработки. При ошибке DELETE повторяем его,
    // не обрабатывая сообщение заново.
    pending = notification
  }
}
