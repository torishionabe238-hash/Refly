import * as FileSystem from 'expo-file-system/legacy'

const FLAG_FILE = `${FileSystem.documentDirectory}onboarding_done.json`

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(FLAG_FILE)
    return info.exists
  } catch { return false }
}

export async function markOnboardingDone(): Promise<void> {
  await FileSystem.writeAsStringAsync(FLAG_FILE, '1')
}
