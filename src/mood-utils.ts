import type { Mood } from './types'

export function getMoodWeek(records: Mood[]) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setHours(0, 0, 0, 0)
    date.setDate(today.getDate() - (6 - index))
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dayRecords = records.filter((record) => {
      const created = new Date(record.createdAt)
      return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth() && created.getDate() === date.getDate()
    })
    return {
      day: new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date).replace('.', ''),
      dateLabel: new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short' }).format(date),
      value: dayRecords.length ? dayRecords.reduce((sum, record) => sum + record.intensity, 0) / dayRecords.length : null,
      count: dayRecords.length,
      key,
    }
  })
  return { days, checkInDays: days.filter((day) => day.count > 0).length }
}

export function activityTime(value: string) {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
}
