import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getStateInstance, describeInstanceState } from '../src/api/greenApi.ts'

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
