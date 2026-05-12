import * as FileSystem from 'expo-file-system/legacy'

const DRAFTS_PATH = FileSystem.documentDirectory + 'refly_drafts.json'

export type Draft = {
  id: string
  contentHtml: string
  preview: string
  savedAt: string
}

const toPreview = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)

export const getDrafts = async (): Promise<Draft[]> => {
  try {
    const info = await FileSystem.getInfoAsync(DRAFTS_PATH)
    if (!info.exists) return []
    const json = await FileSystem.readAsStringAsync(DRAFTS_PATH)
    return JSON.parse(json)
  } catch (_e) { return [] }
}

const writeDrafts = async (drafts: Draft[]): Promise<void> => {
  await FileSystem.writeAsStringAsync(DRAFTS_PATH, JSON.stringify(drafts))
}

export const saveDraft = async (draft: Draft): Promise<void> => {
  const drafts = await getDrafts()
  const idx = drafts.findIndex(d => d.id === draft.id)
  if (idx >= 0) drafts[idx] = draft
  else drafts.unshift(draft)
  await writeDrafts(drafts)
}

export const deleteDraft = async (id: string): Promise<void> => {
  const drafts = await getDrafts()
  await writeDrafts(drafts.filter(d => d.id !== id))
}

export const createDraft = (contentHtml: string): Draft => ({
  id: Date.now().toString(),
  contentHtml,
  preview: toPreview(contentHtml),
  savedAt: new Date().toISOString(),
})

export const updateDraft = (draft: Draft, contentHtml: string): Draft => ({
  ...draft,
  contentHtml,
  preview: toPreview(contentHtml),
  savedAt: new Date().toISOString(),
})
