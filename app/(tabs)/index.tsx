import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { supabase } from '../../utils/supabase'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import DiaryEditor from '../../components/DiaryEditor'
import { createDraft, saveDraft } from '../../utils/drafts'

export default function HomeScreen() {
  const router = useRouter()
  const [editorKey, setEditorKey] = useState(0)
  const [saving, setSaving] = useState(false)

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  const todayISO = new Date().toISOString().split('T')[0]

  const pickImage = async (): Promise<string[]> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) { Alert.alert('エラー', '写真へのアクセスを許可してください'); return [] }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8 })
    if (result.canceled) return []
    return result.assets.map(a => a.uri)
  }

  const uploadPhotos = async (userId: string, photos: string[]): Promise<string[]> => {
    const urls: string[] = []
    for (const uri of photos) {
      const fileName = `${userId}/${Date.now()}.jpg`
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const { error } = await supabase.storage.from('diary-photos').upload(fileName, bytes, { contentType: 'image/jpeg' })
      if (!error) {
        const { data } = supabase.storage.from('diary-photos').getPublicUrl(fileName)
        urls.push(data.publicUrl)
      }
    }
    return urls
  }

  const handleSave = async (content: string, photos: string[]) => {
    if (saving) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { Alert.alert('エラー', 'ログインが必要です'); return }
      const photoUrls = photos.length > 0 ? await uploadPhotos(session.user.id, photos) : []
      const { error } = await supabase.from('diaries').insert({ title: today, content, date: todayISO, user_id: session.user.id, photos: photoUrls })
      if (error) { Alert.alert('エラー', '保存に失敗しました'); return }
      setEditorKey(k => k + 1)
      router.replace('/(tabs)/calendar')
    } catch (_e) {
      Alert.alert('エラー', '予期しないエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDraft = async (html: string) => {
    if (html.replace(/<[^>]*>/g, '').trim() === '') { Alert.alert('エラー', '内容を入力してから下書き保存してください'); return }
    const draft = createDraft(html)
    await saveDraft(draft)
    Alert.alert('完了', '下書きを保存しました')
  }

  return (
    <DiaryEditor
      key={editorKey}
      dateLabel={today}
      saving={saving}
      onSave={handleSave}
      onSaveDraft={handleSaveDraft}
      onPickImage={pickImage}
    />
  )
}
