import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

async function connect(page: Page) {
  await page.goto('/')
  await page.getByLabel('idInstance', { exact: true }).fill('123')
  await page.getByLabel('apiTokenInstance', { exact: true }).fill('test-token')
  await page.getByRole('button', { name: 'Подключиться', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Новый чат' })).toBeVisible()
}

async function createChat(page: Page, phone: string) {
  await page.getByRole('button', { name: 'Новый чат' }).click()
  await page.getByLabel('Номер телефона').fill(phone)
  await page.getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
}

// Все запросы GREEN-API перехватываются: реальный аккаунт не используется.
async function mockApi(page: Page, override: (route: Route, method: string) => Promise<boolean>) {
  await page.route('https://*.api.green-api.com/**', async (route) => {
    const method = new URL(route.request().url()).pathname.split('/')[2]
    if (await override(route, method)) return
    switch (method) {
      case 'getStateInstance':
        await route.fulfill({ json: { stateInstance: 'authorized' } }); break
      case 'checkAccount': {
        const phone = String(route.request().postDataJSON().phoneNumber)
        await route.fulfill({ json: { exist: true, chatId: phone } }); break
      }
      case 'receiveNotification':
        await route.fulfill({ json: null }); break
      case 'deleteNotification':
        await route.fulfill({ json: { result: true } }); break
      default: throw new Error(`Неожиданный метод: ${method}`)
    }
  })
}

test('поле заблокировано во время отправки; ответ остаётся в A, черновик B сохраняется', async ({ page }) => {
  let finishSend: (() => Promise<void>) | undefined
  await mockApi(page, async (route, method) => {
    if (method !== 'sendMessage') return false
    expect(route.request().postDataJSON()).toEqual({ chatId: '79001234567', message: 'Сообщение для A' })
    finishSend = () => route.fulfill({ json: { idMessage: 'sent-a' } })
    return true
  })
  await connect(page)
  await createChat(page, '+79001234568')
  await createChat(page, '+79001234567')
  const input = page.getByRole('textbox', { name: 'Текст сообщения' })
  await input.fill('Сообщение для A')
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect.poll(() => Boolean(finishSend)).toBe(true)
  await expect(input).not.toBeEditable()
  await input.focus()
  await page.keyboard.type('Лишний текст')
  await expect(input).toHaveValue('Сообщение для A')
  await page.getByRole('button', { name: /\+7 900 123-45-68/ }).click()
  await input.fill('Черновик B')
  await finishSend!()
  await expect(page.getByRole('button', { name: /\+7 900 123-45-67/ })).toContainText('Сообщение для A')
  const conversation = page.getByRole('region', { name: /Переписка/ })
  await expect(conversation).not.toContainText('Сообщение для A')
  await expect(input).toHaveValue('Черновик B')
  await page.getByRole('button', { name: /\+7 900 123-45-67/ }).click()
  await expect(conversation).toContainText('Сообщение для A')
  await expect(input).toHaveValue('')
  await expect(input).toBeEditable()
})

test('выход отменяет ожидающий запрос уведомлений', async ({ page }) => {
  let receiving = false
  let aborted = false
  page.on('requestfailed', (request) => {
    if (request.url().includes('/receiveNotification/')) aborted = true
  })
  await mockApi(page, async (_route, method) => {
    if (method !== 'receiveNotification') return false
    receiving = true
    return true // Запрос намеренно остаётся без ответа.
  })
  await connect(page)
  await expect.poll(() => receiving).toBe(true)
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Подключиться', exact: true })).toBeVisible()
  await expect.poll(() => aborted).toBe(true)
})

test('на узком экране входящий текст не сбрасывает чтение старых сообщений; возврат в чат работает', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 })
  let nextMessage = 1
  let limit = 20
  await mockApi(page, async (route, method) => {
    if (method !== 'receiveNotification') return false
    const id = nextMessage++
    await route.fulfill({ json: id <= limit ? {
      receiptId: id,
      body: {
        typeWebhook: 'incomingMessageReceived', idMessage: `incoming-${id}`,
        senderData: { chatId: '79001234567', senderPhoneNumber: 79001234567 },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: `Ответ ${id}\nВторая строка\nТретья строка` } },
      },
    } : null })
    if (id > limit) nextMessage--
    return true
  })
  await connect(page)
  const chat = page.getByRole('button', { name: /\+7 900 123-45-67/ })
  await expect(chat).toContainText('Ответ 20', { timeout: 15000 })
  await chat.click()
  const message = page.getByText('Ответ 20\nВторая строка\nТретья строка', { exact: true }).last()
  const scroller = message.locator('../..')
  await expect.poll(() => scroller.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(80)
  await scroller.evaluate(el => { el.scrollTop = 100; el.dispatchEvent(new Event('scroll', { bubbles: true })) })
  limit = 21
  await expect(page.getByText('Ответ 21\nВторая строка\nТретья строка', { exact: true }).last()).toBeAttached()
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(100)
  await page.getByRole('button', { name: 'Вернуться к списку чатов' }).click()
  await expect(chat).toBeVisible()
  await chat.click()
  await expect(page.getByRole('textbox', { name: 'Текст сообщения' })).toBeVisible()
  await expect(scroller).toBeVisible()
})


test('ошибка отправки разблокирует поле и сохраняет текст для исправления', async ({ page }) => {
  let finishSend: (() => Promise<void>) | undefined
  await mockApi(page, async (route, method) => {
    if (method !== 'sendMessage') return false
    finishSend = () => route.fulfill({ status: 503, body: '' })
    return true
  })
  await connect(page)
  await createChat(page, '+79001234567')
  const input = page.getByRole('textbox', { name: 'Текст сообщения' })
  await input.fill('Сохранить при ошибке')
  await page.getByRole('button', { name: 'Отправить', exact: true }).click()
  await expect.poll(() => Boolean(finishSend)).toBe(true)
  await expect(input).not.toBeEditable()
  await finishSend!()
  await expect(page.getByRole('alert')).toContainText('503')
  await expect(input).toBeEditable()
  await expect(input).toHaveValue('Сохранить при ошибке')
  await input.fill('Исправленный текст')
  await expect(input).toHaveValue('Исправленный текст')
})
