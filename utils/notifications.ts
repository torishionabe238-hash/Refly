import { Platform } from 'react-native'
import { storageGet, storageSet } from './storage'

export type NotificationPrefs = {
  enabled: boolean
  hour: number
  minute: number
}

const DEFAULT_PREFS: NotificationPrefs = { enabled: false, hour: 21, minute: 0 }

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const json = await storageGet('notification_prefs')
    return json ? JSON.parse(json) : DEFAULT_PREFS
  } catch { return DEFAULT_PREFS }
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await storageSet('notification_prefs', JSON.stringify(prefs))
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  const Notifications = await import('expo-notifications')
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function scheduleReminder(hour: number, minute: number): Promise<void> {
  if (Platform.OS === 'web') return
  const Notifications = await import('expo-notifications')
  await Notifications.cancelAllScheduledNotificationsAsync()
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📔 今日のことを書いてみよう',
      body: '日記を書いて、話のネタを増やそう！',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  })
}

export async function cancelReminder(): Promise<void> {
  if (Platform.OS === 'web') return
  const Notifications = await import('expo-notifications')
  await Notifications.cancelAllScheduledNotificationsAsync()
}
