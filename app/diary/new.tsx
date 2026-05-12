import { Alert, View, Keyboard, Platform } from 'react-native'
import { useState, useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../utils/supabase'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import DiaryEditor from '../../components/DiaryEditor'
import { saveDraft, createDraft } from '../../utils/drafts'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ensureTagIds, setDiaryTags, getTagOrder, applyTagOrder } from '../../utils/tags'

export default function NewDiary() {
  const { date } = useLocalSearchParams<{ date: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [kbHeight, setKbHeight] = useState(0)
  const [saving, setSaving] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('tags').select('id, name').order('name'),
      getTagOrder(),
    ]).then(([{ data }, order]) => {
      setAvailableTags(applyTagOrder(data ?? [], order).map((t: any) => t.name))
    })
  }, [])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, e => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

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

  const handleSaveDraft = async (html: string) => {
    await saveDraft(createDraft(html))
  }

  const handleSave = async (content: string, photos: string[]) => {
    if (saving) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const photoUrls = photos.length > 0 ? await uploadPhotos(session.user.id, photos) : []
      const { data: inserted, error } = await supabase
        .from('diaries')
        .insert({ title: date, content, date, user_id: session.user.id, photos: photoUrls })
        .select('id')
        .single()
      if (error || !inserted) { Alert.alert('エラー', '保存に失敗しました'); return }
      if (tags.length > 0) {
        const tagIds = await ensureTagIds(session.user.id, tags)
        await setDiaryTags(inserted.id, tagIds)
      }
      router.back()
    } catch (_e) {
      Alert.alert('エラー', '予期しないエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={{ flex: 1, paddingBottom: kbHeight > 0 ? kbHeight + 12 : insets.bottom }}>
      <DiaryEditor
        dateLabel={date}
        saving={saving}
        disableKAV
        tags={tags}
        availableTags={availableTags}
        onTagsChange={setTags}
        onSave={handleSave}
        onSaveDraft={handleSaveDraft}
        onPickImage={pickImage}
      />
    </View>
  )
}
