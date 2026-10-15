import { messengerConfig } from '../config.ts'

export type Credentials = {
  idInstance: string
  apiTokenInstance: string
}

type StateResult =
  | { ok: true; state: string }
  | { ok: false; message: string }

type ApiResult = { ok: true; data: unknown } | { ok: false; message: string }

export const MAX_MESSAGE_LENGTH = 4096

const REQUEST_TIMEOUT_MS = 15_000

// Telegram: https://green-api.com/telegram/docs/api/account/GetStateInstance/
async function request(credentials: Credentials, method: string, body?: object): Promise<ApiResult> {
  const id = credentials.idInstance.trim()
  const token = credentials.apiTokenInstance.trim()
  if (!/^\d+$/.test(id) || !token) {
    return { ok: false, message: 'Укажите числовой idInstance и непустой apiTokenInstance.' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${messengerConfig.apiUrl}/waInstance${id}/${method}/${encodeURIComponent(token)}`,
      {
        method: body ? 'POST' : 'GET',
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      },
    )

    // Не показываем тело ошибки или URL: они могут содержать токен.
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: 'GREEN-API отклонил авторизацию (HTTP 401). Проверьте данные инстанса в кабинете.',
        403: 'GREEN-API отказал в доступе (HTTP 403). Причиной могут быть данные инстанса или ограничения на стороне сервиса.',
        429: 'Слишком много запросов (HTTP 429). Подождите и повторите проверку вручную.',
      }
      return {
        ok: false,
        message: messages[response.status] ?? `Ошибка GREEN-API (HTTP ${response.status}). Повторите проверку позже.`,
      }
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      if (controller.signal.aborted) {
        return { ok: false, message: 'GREEN-API не ответил за 15 секунд. Попробуйте позже.' }
      }
      return { ok: false, message: 'GREEN-API вернул некорректный JSON.' }
    }
    return { ok: true, data }
  } catch {
    return {
      ok: false,
      message: controller.signal.aborted
        ? 'GREEN-API не ответил за 15 секунд. Попробуйте позже.'
        : 'Не удалось связаться с GREEN-API. Возможны проблема сети, недоступность сервиса или блокировка запроса браузером (CORS).',
    }
  } finally {
    clearTimeout(timeout)
  }
}

function isObject(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null
}

export async function getStateInstance(credentials: Credentials): Promise<StateResult> {
  const result = await request(credentials, 'getStateInstance')
  if (!result.ok) return result
  const data = result.data
  if (!isObject(data) || typeof data.stateInstance !== 'string' || !data.stateInstance.trim()) {
    return { ok: false, message: 'В ответе GREEN-API отсутствует корректное состояние инстанса.' }
  }
  return { ok: true, state: data.stateInstance }
}

export async function checkAccount(credentials: Credentials, phoneNumber: string): Promise<
  { ok: true; chatId: string } | { ok: false; message: string }
> {
  if (!/^[1-9]\d{6,14}$/.test(phoneNumber)) {
    return { ok: false, message: 'Некорректный международный номер телефона.' }
  }
  const result = await request(credentials, 'checkAccount', { phoneNumber: Number(phoneNumber) })
  if (!result.ok) return result
  const data = result.data
  if (isObject(data) && data.status === false) {
    return { ok: false, message: 'Проверка аккаунта отклонена сервисом. Возможны ограничения поиска или неготовность инстанса. Проверьте кабинет GREEN-API.' }
  }
  if (isObject(data) && data.exist === false) {
    return { ok: false, message: 'Аккаунт не найден или номер скрыт настройками приватности.' }
  }
  if (!isObject(data) || data.exist !== true || typeof data.chatId !== 'string' || !/^[1-9]\d*$/.test(data.chatId)) {
    return { ok: false, message: 'GREEN-API не вернул корректный идентификатор личного чата.' }
  }
  return { ok: true, chatId: data.chatId }
}

export async function sendTextMessage(credentials: Credentials, chatId: string, message: string): Promise<
  { ok: true; idMessage: string } | { ok: false; message: string }
> {
  if (!message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, message: `Введите текст от 1 до ${MAX_MESSAGE_LENGTH} символов.` }
  }
  if (!/^[1-9]\d*$/.test(chatId)) return { ok: false, message: 'Некорректный идентификатор личного чата.' }
  const result = await request(credentials, 'sendMessage', { chatId, message })
  if (!result.ok) {
    return { ok: false, message: `${result.message} Отправка не подтверждена. Перед повтором проверьте Telegram: сообщение могло быть принято сервисом.` }
  }
  const data = result.data
  if (!isObject(data) || typeof data.idMessage !== 'string' || !data.idMessage.trim()) {
    return { ok: false, message: 'Нет идентификатора сообщения в ответе. Перед повторной отправкой проверьте Telegram: сообщение могло быть принято сервисом.' }
  }
  return { ok: true, idMessage: data.idMessage }
}

export function describeInstanceState(state: string): string {
  switch (state) {
    case 'notAuthorized': return 'Инстанс не авторизован. Завершите авторизацию в кабинете GREEN-API.'
    case 'pendingPassword': return 'Для авторизации требуется пароль двухфакторной аутентификации. Завершите подключение в кабинете GREEN-API.'
    case 'starting': return 'Инстанс запускается или находится на обслуживании. Повторите проверку позже.'
    case 'blocked': return 'Инстанс заблокирован. Проверьте его состояние в кабинете GREEN-API.'
    case 'suspended': return 'На аккаунт наложены временные ограничения. Проверьте их в кабинете GREEN-API.'
    default: return 'GREEN-API вернул неизвестное состояние инстанса. Подключение не подтверждено.'
  }
}
