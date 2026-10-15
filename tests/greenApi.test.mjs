import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getStateInstance, describeInstanceState, checkAccount, sendTextMessage } from '../src/api/greenApi.ts'

const credentials = { idInstance: '123', apiTokenInstance: 'test-token' }

test('использует адрес инстанса и возвращает authorized', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://4100.api.green-api.com/waInstance123/getStateInstance/test-token')
    assert.equal(options.method, 'GET')
    assert.equal(options.cache, 'no-store')
    return Response.json({ stateInstance: 'authorized' })
  })
  assert.deepEqual(await getStateInstance(credentials), { ok: true, state: 'authorized' })
})

test('отклоняет незаполненные данные без запроса', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Не должен вызываться') })
  assert.equal((await getStateInstance({ idInstance: 'abc', apiTokenInstance: '' })).ok, false)
  assert.equal(fetch.mock.callCount(), 0)
})

test('403 не считается успешным подключением и не раскрывает тело ответа', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('test-token', { status: 403 }))
  const result = await getStateInstance(credentials)
  assert.equal(result.ok, false)
  assert.match(result.message, /403/)
  assert.doesNotMatch(result.message, /test-token/)
})

test('обрабатывает 429 и 503', async (t) => {
  for (const status of [429, 503]) {
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status }))
    const result = await getStateInstance(credentials)
    assert.equal(result.ok, false)
    assert.match(result.message, new RegExp(String(status)))
  }
})

test('отклоняет некорректный JSON и неверную структуру', async (t) => {
  for (const body of ['<html>error</html>', 'null', '{}', '{"stateInstance":123}', '{"stateInstance":""}']) {
    t.mock.method(globalThis, 'fetch', async () => new Response(body))
    assert.equal((await getStateInstance(credentials)).ok, false)
  }
})

test('не раскрывает исходную сетевую ошибку', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('URL with test-token') })
  const result = await getStateInstance(credentials)
  assert.equal(result.ok, false)
  assert.match(result.message, /сети/)
  assert.doesNotMatch(result.message, /test-token/)
})

test('прерывает зависший запрос по таймауту', async (t) => {
  const originalSetTimeout = globalThis.setTimeout
  t.mock.method(globalThis, 'setTimeout', (callback, milliseconds) => {
    assert.equal(milliseconds, 15_000)
    return originalSetTimeout(callback, 1)
  })
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })
  }))
  const result = await getStateInstance(credentials)
  assert.equal(result.ok, false)
  assert.match(result.message, /15 секунд/)
})

test('сохраняет неавторизованное состояние и объясняет известные статусы', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ stateInstance: 'starting' }))
  assert.deepEqual(await getStateInstance(credentials), { ok: true, state: 'starting' })
  assert.match(describeInstanceState('starting'), /запускается/)
  assert.match(describeInstanceState('notAuthorized'), /не авторизован/)
  assert.match(describeInstanceState('pendingPassword'), /пароль/)
  assert.match(describeInstanceState('blocked'), /заблокирован/)
  assert.match(describeInstanceState('suspended'), /ограничения/)
  assert.match(describeInstanceState('future-state'), /неизвестное/)
})

test('CheckAccount отправляет номер числом и возвращает chatId', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /\/checkAccount\//)
    assert.equal(options.method, 'POST')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), { phoneNumber: 79001234567 })
    return Response.json({ exist: true, chatId: '987654321' })
  })
  assert.deepEqual(await checkAccount(credentials, '79001234567'), { ok: true, chatId: '987654321' })
})

test('CheckAccount не создаёт чат для отсутствующего или скрытого аккаунта', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ exist: false, chatId: '' }))
  const result = await checkAccount(credentials, '79001234567')
  assert.equal(result.ok, false)
  assert.match(result.message, /приватности/)
})

test('CheckAccount отклоняет сервисную ошибку HTTP 200 и неправильный chatId', async (t) => {
  for (const body of [{ status: false, reason: 'instance is starting or not authorized' },
    { exist: true }, { exist: true, chatId: 123 }, { exist: true, chatId: '-123' }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body))
    assert.equal((await checkAccount(credentials, '79001234567')).ok, false)
  }
})

test('SendMessage сохраняет адресата и переносы текста, возвращает серверный ID', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /\/sendMessage\//)
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { chatId: '987654321', message: 'Привет!\nВторая строка' })
    return Response.json({ idMessage: 'message-from-api' })
  })
  assert.deepEqual(await sendTextMessage(credentials, '987654321', 'Привет!\nВторая строка'),
    { ok: true, idMessage: 'message-from-api' })
})

test('SendMessage не делает запрос для пустого и слишком длинного текста', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Не должен вызываться') })
  for (const text of [' \n ', 'a'.repeat(4097)]) {
    assert.equal((await sendTextMessage(credentials, '987654321', text)).ok, false)
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('SendMessage не повторяет неоднозначный запрос и не раскрывает ошибку с токеном', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('test-token') })
  const result = await sendTextMessage(credentials, '987654321', 'Привет!')
  assert.equal(result.ok, false)
  assert.match(result.message, /Перед повтором проверьте Telegram/)
  assert.doesNotMatch(result.message, /test-token/)
  assert.equal(fetch.mock.callCount(), 1)
})

test('SendMessage не считает HTTP 200 без ID подтверждением отправки', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: false }))
  const result = await sendTextMessage(credentials, '987654321', 'Привет!')
  assert.equal(result.ok, false)
  assert.match(result.message, /Перед повторной отправкой/)
})
