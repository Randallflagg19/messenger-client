// Форматирование 11-значного номера из примера для отображения.
export function formatPhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(
    /^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/,
    '+$1 $2 $3-$4-$5',
  )
}

export function resizeComposer(input: HTMLTextAreaElement) {
  // Сначала сбрасываем высоту, чтобы поле уменьшалось при удалении текста.
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight + 2}px`
}
