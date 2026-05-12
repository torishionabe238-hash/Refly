import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'

export async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key)
  }
  try {
    const path = `${FileSystem.documentDirectory}${key}.json`
    const info = await FileSystem.getInfoAsync(path)
    if (!info.exists) return null
    return FileSystem.readAsStringAsync(path)
  } catch { return null }
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value)
    return
  }
  try {
    const path = `${FileSystem.documentDirectory}${key}.json`
    await FileSystem.writeAsStringAsync(path, value)
  } catch {}
}

export async function storageRemove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key)
    return
  }
  try {
    const path = `${FileSystem.documentDirectory}${key}.json`
    await FileSystem.deleteAsync(path, { idempotent: true })
  } catch {}
}
