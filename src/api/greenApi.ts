import { messengerConfig } from '../config.ts'

type Credentials = {
  idInstance: string
  apiTokenInstance: string
}

type StateResult =
  | { ok: true; state: string }
  | { ok: false; message: string }

const REQUEST_TIMEOUT_MS = 15_000

// Telegram: https://green-api.com/telegram/docs/api/account/GetStateInstance/
export async function getStateInstance(credentials: Credentials): Promise<StateResult> {
  const id = credentials.idInstance.trim()
  const token = credentials.apiTokenInstance.trim()
  if (!/^\d+$/.test(id) || !token) {
    return { ok: false, message: 'Укажите числовой idInstance и непустой apiTokenInstance.' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${messengerConfig.apiUrl}/waInstance${id}/getStateInstance/${encodeURIComponent(token)}`,
      {
        method: 'GET',
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
    if (typeof data !== 'object' || data === null || !('stateInstance' in data)
      || typeof data.stateInstance !== 'string' || !data.stateInstance.trim()) {
      return { ok: false, message: 'В ответе GREEN-API отсутствует корректное состояние инстанса.' }
    }
    return { ok: true, state: data.stateInstance }
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
