import { supabase } from './supabase'
import { storageGet, storageSet } from './storage'

export async function getTagOrder(): Promise<string[]> {
  try {
    const json = await storageGet('tag_order')
    return json ? JSON.parse(json) : []
  } catch { return [] }
}

export async function saveTagOrder(ids: string[]): Promise<void> {
  await storageSet('tag_order', JSON.stringify(ids))
}

export function applyTagOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return items
  const map = new Map(items.map(t => [t.id, t]))
  const ordered = order.map(id => map.get(id)).filter(Boolean) as T[]
  const rest = items.filter(t => !order.includes(t.id))
  return [...ordered, ...rest]
}

export async function ensureTagIds(userId: string, names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const { data } = await supabase
    .from('tags')
    .upsert(
      names.map(name => ({ user_id: userId, name })),
      { onConflict: 'user_id,name' }
    )
    .select('id, name')
  if (!data) return []
  return names.map(name => data.find((d: any) => d.name === name)?.id).filter(Boolean) as string[]
}

export async function setDiaryTags(diaryId: string, tagIds: string[]): Promise<void> {
  await supabase.from('diary_tags').delete().eq('diary_id', diaryId)
  if (tagIds.length > 0) {
    await supabase.from('diary_tags').insert(
      tagIds.map(tag_id => ({ diary_id: diaryId, tag_id }))
    )
  }
}

export function extractTagNames(diaryTags: { tags: { name: string } | null }[]): string[] {
  return (diaryTags ?? []).map((dt: any) => dt.tags?.name).filter(Boolean) as string[]
}
