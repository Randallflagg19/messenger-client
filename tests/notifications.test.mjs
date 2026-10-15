import assert from 'node:assert/strict'
import { test } from 'node:test'
import { receiveNotification, deleteNotification } from '../src/api/greenApi.ts'
import { parseIncomingText, runNotificationLoop } from '../src/api/notifications.ts'

const credentials = { idInstance: '123', apiTokenInstance: 'test-token' }
const body = {
  typeWebhook: 'incomingMessageReceived', idMessage: 'incoming-1',
  senderData: { chatId: '987', senderName: 'Собеседник', senderPhoneNumber: 79001234567 },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Ответ\nВторая строка' } },
}
const notification = { receiptId: 42, body }

function fastWaits(t) {
  const original = globalThis.setTimeout
  t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => original(callback, ms === 15000 ? ms : 0, ...args))
}

test('разбирает текст и сохраняет chatId, idMessage и переносы', () => {
  assert.deepEqual(parseIncomingText(body), {
    chat: { id: '987', phoneNumber: '79001234567', name: 'Собеседник' },
    message: { id: 'incoming-1', chatId: '987', text: 'Ответ\nВторая строка', direction: 'incoming' },
  })
})

test('принимает текст со ссылкой и скрытым номером', () => {
  const result = parseIncomingText({ ...body,
    senderData: { chatId: '987', senderPhoneNumber: 0 },
    messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'https://example.com' } },
  })
  assert.equal(result.chat.phoneNumber, undefined)
  assert.equal(result.message.text, 'https://example.com')
})

test('пропускает группы, вложения и сервисные события', () => {
  assert.equal(parseIncomingText({ typeWebhook: 'outgoingMessageStatus' }), null)
  assert.equal(parseIncomingText({ ...body, senderData: { chatId: '-987' } }), null)
  assert.equal(parseIncomingText({ ...body, messageData: { typeMessage: 'imageMessage' } }), null)
})

test('не считает сломанное текстовое уведомление неподдерживаемым', () => {
  assert.throws(() => parseIncomingText({ ...body, messageData: { typeMessage: 'textMessage' } }))
  assert.throws(() => parseIncomingText({ ...body, idMessage: undefined }))
})

test('receive принимает null и пустой ответ без сообщения', async (t) => {
  for (const text of ['null', '']) {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.match(url, /receiveNotification\/test-token\?receiveTimeout=5$/)
      assert.equal(options.method, 'GET')
      return new Response(text)
    })
    assert.deepEqual(await receiveNotification(credentials, new AbortController().signal), { ok: true, notification: null })
  }
})

test('отклоняет испорченный receiptId и не подтверждает result:false', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ receiptId: '42', body }))
  assert.equal((await receiveNotification(credentials, new AbortController().signal)).ok, false)
  t.mock.method(globalThis, 'fetch', async () => Response.json({ result: false }))
  assert.equal((await deleteNotification(credentials, 42, new AbortController().signal)).ok, false)
})

test('порядок receive → обработка → DELETE, повтор DELETE не дублирует обработку', async (t) => {
  fastWaits(t)
  const controller = new AbortController()
  const events = []
  let deletes = 0
  let receives = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.includes('/receiveNotification/')) {
      events.push('receive')
      if (++receives === 2) { controller.abort(); return Response.json(null) }
      return Response.json(notification)
    }
    assert.match(url, /deleteNotification\/test-token\/42$/)
    assert.equal(options.method, 'DELETE')
    events.push('delete')
    if (++deletes === 1) return new Response('', { status: 503 })
    return Response.json({ result: true })
  })
  const statuses = []
  await runNotificationLoop(credentials, controller.signal, () => events.push('process'), (status) => statuses.push(status.kind))
  assert.deepEqual(events, ['receive', 'process', 'delete', 'delete', 'receive'])
  assert.ok(statuses.includes('retrying'))
})

test('403 останавливает цикл без автоматического повтора', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 403 }))
  let lastStatus
  await runNotificationLoop(credentials, new AbortController().signal, () => assert.fail(), (status) => { lastStatus = status })
  assert.equal(fetch.mock.callCount(), 1)
  assert.equal(lastStatus.kind, 'stopped')
})

test('ошибка разбора оставляет уведомление в очереди', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ receiptId: 42, body: { ...body, idMessage: null } }))
  let lastStatus
  await runNotificationLoop(credentials, new AbortController().signal, () => assert.fail(), (status) => { lastStatus = status })
  assert.equal(fetch.mock.callCount(), 1)
  assert.equal(lastStatus.kind, 'stopped')
})

test('неподдерживаемое событие подтверждается и очередь продолжается', async (t) => {
  fastWaits(t)
  const controller = new AbortController()
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++
    if (calls === 1) return Response.json({ receiptId: 42, body: { typeWebhook: 'outgoingMessageStatus' } })
    if (calls === 2) { assert.equal(options.method, 'DELETE'); return Response.json({ result: true }) }
    controller.abort()
    return Response.json(null)
  })
  await runNotificationLoop(credentials, controller.signal, () => assert.fail(), () => {})
  assert.equal(calls, 3)
})

test('отмена останавливает ожидающий fetch без последующего DELETE', async (t) => {
  const controller = new AbortController()
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      controller.abort()
    })
  })
  await runNotificationLoop(credentials, controller.signal, () => assert.fail(), () => assert.fail())
  assert.equal(fetch.mock.callCount(), 1)
})

test('пробный запуск StrictMode отменяется до запроса', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail())
  const controller = new AbortController()
  const loop = runNotificationLoop(credentials, controller.signal, () => assert.fail(), () => assert.fail())
  controller.abort()
  await loop
  assert.equal(fetch.mock.callCount(), 0)
})
