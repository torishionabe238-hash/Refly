import { storageGet, storageSet } from './storage'

export type Draft = {
  id: string
  contentHtml: string
  preview: string
  savedAt: string
}

const KEY = 'refly_drafts'

const toPreview = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)

export const getDrafts = async (): Promise<Draft[]> => {
  try {
    const json = await storageGet(KEY)
    return json ? JSON.parse(json) : []
  } catch { return [] }
}

const writeDrafts = async (drafts: Draft[]) => {
  await storageSet(KEY, JSON.stringify(drafts))
}

export const saveDraft = async (draft: Draft) => {
  const drafts = await getDrafts()
  const idx = drafts.findIndex(d => d.id === draft.id)
  if (idx >= 0) drafts[idx] = draft
  else drafts.unshift(draft)
  await writeDrafts(drafts)
}

export const deleteDraft = async (id: string) => {
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
