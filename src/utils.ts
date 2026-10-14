// Базовая проверка международной записи, без проверки аккаунта Telegram.
export function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim()
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return null
  const digits = trimmed.replace(/[\s()-]/g, '').replace(/^\+/, '')
  if (!trimmed.startsWith('+') && /^8\d{10}$/.test(digits)) {
    return `7${digits.slice(1)}`
  }
  return /^[1-9]\d{6,14}$/.test(digits) ? digits : null
}

export function formatPhoneNumber(phoneNumber: string): string {
  if (/^7\d{10}$/.test(phoneNumber)) {
    return phoneNumber.replace(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, '+$1 $2 $3-$4-$5')
  }
  return `+${phoneNumber}`
}

export function resizeComposer(input: HTMLTextAreaElement) {
  // Сначала сбрасываем высоту, чтобы поле уменьшалось при удалении текста.
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight + 2}px`
}
