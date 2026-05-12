import { storageGet, storageSet } from './storage'

export async function hasSeenOnboarding(): Promise<boolean> {
  const val = await storageGet('onboarding_done')
  return val !== null
}

export async function markOnboardingDone(): Promise<void> {
  await storageSet('onboarding_done', '1')
}
