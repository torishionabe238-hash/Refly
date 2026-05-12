import * as Notifications from 'expo-notifications'
import * as FileSystem from 'expo-file-system/legacy'

const PREFS_FILE = `${FileSystem.documentDirectory}notification_prefs.json`

export type NotificationPrefs = {
  enabled: boolean
  hour: number
  minute: number
}

const DEFAULT_PREFS: NotificationPrefs = { enabled: false, hour: 21, minute: 0 }

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const info = await FileSystem.getInfoAsync(PREFS_FILE)
    if (!info.exists) return DEFAULT_PREFS
    return JSON.parse(await FileSystem.readAsStringAsync(PREFS_FILE))
  } catch { return DEFAULT_PREFS }
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await FileSystem.writeAsStringAsync(PREFS_FILE, JSON.stringify(prefs))
}

export async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function scheduleReminder(hour: number, minute: number): Promise<void> {
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
  await Notifications.cancelAllScheduledNotificationsAsync()
}
