import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ScrollView, Keyboard, Platform, Dimensions } from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../utils/supabase'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { Ionicons } from '@expo/vector-icons'
import WebView from 'react-native-webview'
import { useTheme } from '../../utils/theme'
import { ensureTagIds, setDiaryTags, extractTagNames, getTagOrder, applyTagOrder } from '../../utils/tags'

const COLORS = ['#E24B4A', '#F97316', '#1D9E75', '#3B82F6', '#8B5CF6']

const EDITOR_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; background: #fff; height: 100%; }
#editor {
  min-height: 100vh; font-size: 17px;
  font-family: -apple-system, 'Helvetica Neue', sans-serif;
  line-height: 1.75; color: #333; padding: 16px;
  outline: none; word-break: break-word;
}
#editor:empty::before { content: attr(data-placeholder); color: #bbb; pointer-events: none; display: block; }
h1 { font-size: 24px; font-weight: 700; margin: 8px 0 4px; }
h2 { font-size: 20px; font-weight: 700; margin: 6px 0 4px; }
p { margin: 0 0 4px; }
ul, ol { padding-left: 22px; margin: 4px 0; }
</style>
</head>
<body>
<div id="editor" contenteditable="true" data-placeholder="日記を編集..."></div>
<script>
var editor = document.getElementById('editor');
function sendState() {
  var block = document.queryCommandValue('formatBlock').toLowerCase();
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'state',
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'),
    h1: block === 'h1', h2: block === 'h2' }));
}
function execCmd(cmd, value) {
  editor.focus();
  if (cmd === 'formatBlock') {
    var cur = document.queryCommandValue('formatBlock').toLowerCase();
    document.execCommand('formatBlock', false, (cur === value.toLowerCase()) ? 'p' : value);
  } else { document.execCommand(cmd, false, value || null); }
  sendContent(); sendState();
}
function setContent(html) { editor.innerHTML = html || ''; sendContent(); }
function sendContent() {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'content', html: editor.innerHTML }));
}
editor.addEventListener('input', sendContent);
document.addEventListener('selectionchange', sendState);
</script>
</body>
</html>`

type PhotoItem = { type: 'existing'; url: string } | { type: 'new'; uri: string }

export default function EditDiary() {
  const { accent, accentBg, accentBorder, card, text, sub, border, inputBg } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [date, setDate] = useState('')
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [saving, setSaving] = useState(false)
  const [showColors, setShowColors] = useState(false)
  const [contentHtml, setContentHtml] = useState('')
  const [fmt, setFmt] = useState({ bold: false, italic: false, underline: false, h1: false, h2: false })
  const [initialHtml, setInitialHtml] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const webViewRef = useRef<WebView>(null)
  const router = useRouter()

  const addTag = (name?: string) => {
    const t = (name ?? tagInput).trim()
    if (!t || tags.includes(t)) { setTagInput(''); return }
    setTags(prev => [...prev, t])
    setTagInput('')
  }

  const removeTag = (i: number) => setTags(prev => prev.filter((_, idx) => idx !== i))

  const suggestions = availableTags.filter(t => !tags.includes(t))

  const photoSize = Math.floor((Dimensions.get('window').width - 48 - 8) / 2)
  const insets = useSafeAreaInsets()
  const [kbHeight, setKbHeight] = useState(0)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, e => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  useEffect(() => {
    fetchDiary()
    Promise.all([
      supabase.from('tags').select('id, name').order('name'),
      getTagOrder(),
    ]).then(([{ data }, order]) => {
      setAvailableTags(applyTagOrder(data ?? [], order).map((t: any) => t.name))
    })
  }, [])

  const fetchDiary = async () => {
    const [{ data }, { data: diaryTagsData }, { data: tagsData }] = await Promise.all([
      supabase.from('diaries').select('content, photos, date, tags').eq('id', id).maybeSingle(),
      supabase.from('diary_tags').select('tag_id').eq('diary_id', id),
      supabase.from('tags').select('id, name'),
    ])
    if (data) {
      setDate(data.date)
      setInitialHtml(data.content)
      setContentHtml(data.content)
      setPhotos((data.photos || []).map((url: string) => ({ type: 'existing', url })))
      const tagMap: Record<string, string> = {}
      ;(tagsData ?? []).forEach((t: any) => { tagMap[t.id] = t.name })
      const relationalTags = (diaryTagsData ?? []).map((dt: any) => tagMap[dt.tag_id]).filter(Boolean)
      setTags(relationalTags.length > 0 ? relationalTags : (Array.isArray(data.tags) ? data.tags : []))
    }
  }

  const onLoad = () => {
    if (initialHtml) {
      webViewRef.current?.injectJavaScript(`setContent(${JSON.stringify(initialHtml)}); true;`)
    }
  }

  const exec = (cmd: string, value?: string) => {
    const v = value ? JSON.stringify(value) : 'null'
    webViewRef.current?.injectJavaScript(`execCmd(${JSON.stringify(cmd)}, ${v}); true;`)
    setShowColors(false)
  }

  const onMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg.type === 'content') setContentHtml(msg.html)
      if (msg.type === 'state') setFmt({ bold: msg.bold, italic: msg.italic, underline: msg.underline, h1: msg.h1, h2: msg.h2 })
    } catch (_e) {}
  }

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) { Alert.alert('エラー', '写真へのアクセスを許可してください'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8 })
    if (!result.canceled) setPhotos(prev => [...prev, ...result.assets.map(a => ({ type: 'new' as const, uri: a.uri }))])
  }

  const uploadNewPhotos = async (userId: string): Promise<string[]> => {
    const urls: string[] = []
    for (const item of photos.filter(p => p.type === 'new') as { type: 'new'; uri: string }[]) {
      const fileName = `${userId}/${Date.now()}.jpg`
      const base64 = await FileSystem.readAsStringAsync(item.uri, { encoding: 'base64' })
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const { error } = await supabase.storage.from('diary-photos').upload(fileName, bytes, { contentType: 'image/jpeg' })
      if (!error) { const { data } = supabase.storage.from('diary-photos').getPublicUrl(fileName); urls.push(data.publicUrl) }
    }
    return urls
  }

  const isEmpty = contentHtml.replace(/<[^>]*>/g, '').trim() === ''

  const save = async () => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const existingUrls = photos.filter(p => p.type === 'existing').map(p => (p as any).url)
      const uploadedUrls = await uploadNewPhotos(session.user.id)
      const { error } = await supabase.from('diaries').update({ content: contentHtml, photos: [...existingUrls, ...uploadedUrls] }).eq('id', id)
      if (error) { Alert.alert('エラー', '保存に失敗しました'); return }
      const tagIds = await ensureTagIds(session.user.id, tags)
      await setDiaryTags(id as string, tagIds)
      router.back()
    } catch (_e) { Alert.alert('エラー', '予期しないエラーが発生しました') }
    finally { setSaving(false) }
  }

  if (initialHtml === null) return null

  return (
    <View style={[styles.container, { paddingBottom: kbHeight > 0 ? kbHeight + 12 : insets.bottom }]}>
      <Text style={styles.date}>{date}</Text>

      <WebView
        ref={webViewRef}
        source={{ html: EDITOR_HTML }}
        style={styles.webview}
        onLoad={onLoad}
        onMessage={onMessage}
        scrollEnabled
        keyboardDisplayRequiresUserAction={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        hideKeyboardAccessoryView
      />

      {photos.length > 0 && (
        <ScrollView horizontal style={styles.photoList} showsHorizontalScrollIndicator={false}>
          {photos.map((item, i) => (
            <View key={i} style={styles.photoWrapper}>
              <Image source={{ uri: item.type === 'existing' ? item.url : item.uri }} style={[styles.photo, { width: photoSize, height: photoSize }]} />
              <TouchableOpacity style={styles.photoDelete} onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                <Ionicons name="close" size={10} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {showColors && (
        <View style={styles.colorPalette}>
          {COLORS.map(c => (
            <TouchableOpacity key={c} style={[styles.colorSwatch, { backgroundColor: c }]} onPress={() => exec('foreColor', c)} />
          ))}
          <TouchableOpacity style={styles.colorSwatchReset} onPress={() => exec('foreColor', '#333333')}>
            <Text style={styles.colorResetText}>戻す</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.toolbar}>
        <TouchableOpacity style={[styles.fmtBtn, fmt.bold && styles.fmtBtnActive]} onPress={() => exec('bold')}><Text style={[styles.fmtBold, fmt.bold && styles.fmtTextActive]}>B</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.italic && styles.fmtBtnActive]} onPress={() => exec('italic')}><Text style={[styles.fmtItalic, fmt.italic && styles.fmtTextActive]}>I</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.underline && styles.fmtBtnActive]} onPress={() => exec('underline')}><Text style={[styles.fmtUnderline, fmt.underline && styles.fmtTextActive]}>U</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.h1 && styles.fmtBtnActive]} onPress={() => exec('formatBlock', 'h1')}><Text style={[styles.fmtText, fmt.h1 && styles.fmtTextActive]}>H1</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.h2 && styles.fmtBtnActive]} onPress={() => exec('formatBlock', 'h2')}><Text style={[styles.fmtText, fmt.h2 && styles.fmtTextActive]}>H2</Text></TouchableOpacity>
        <TouchableOpacity style={styles.fmtBtn} onPress={() => exec('insertUnorderedList')}><Ionicons name="list-outline" size={18} color="#555" /></TouchableOpacity>
        <View style={styles.fmtDivider} />
        <TouchableOpacity style={[styles.fmtBtn, showColors && styles.fmtBtnActive]} onPress={() => setShowColors(v => !v)}>
          <View style={styles.colorDot} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.fmtBtn} onPress={() => exec('undo')}><Ionicons name="arrow-undo-outline" size={17} color="#555" /></TouchableOpacity>
        <TouchableOpacity style={styles.fmtBtn} onPress={() => exec('redo')}><Ionicons name="arrow-redo-outline" size={17} color="#555" /></TouchableOpacity>
      </View>

      {/* タグ入力 */}
      <View style={[styles.tagArea, { backgroundColor: inputBg, borderTopColor: border }]}>
        <Ionicons name="pricetag-outline" size={14} color={sub} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 6 }}>
          {suggestions.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
              {suggestions.map((tag, i) => (
                <TouchableOpacity key={i} style={[styles.tagSuggestion, { borderColor: accentBorder }]} onPress={() => addTag(tag)}>
                  <Text style={[styles.tagSuggestionText, { color: accent }]}>#{tag}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center', paddingRight: 8 }}>
            {tags.map((tag, i) => (
              <TouchableOpacity key={i} style={[styles.tagChip, { backgroundColor: accentBg }]} onPress={() => removeTag(i)}>
                <Text style={[styles.tagChipText, { color: accent }]}>#{tag}</Text>
                <Ionicons name="close" size={10} color={accent} />
              </TouchableOpacity>
            ))}
            <TextInput
              style={[styles.tagInput, { color: text }]}
              placeholder="タグを追加..."
              placeholderTextColor={sub}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={() => addTag()}
              returnKeyType="done"
              blurOnSubmit={false}
            />
          </ScrollView>
        </View>
      </View>

      <View style={[styles.bottomBar, { backgroundColor: card, borderTopColor: border }]}>
        <TouchableOpacity style={[styles.cameraButton, { backgroundColor: inputBg }]} onPress={pickImage}><Ionicons name="camera-outline" size={22} color={sub} /></TouchableOpacity>
        <TouchableOpacity style={[styles.saveButton, { backgroundColor: accent }, (saving || isEmpty) && styles.saveButtonDisabled]} onPress={save} disabled={saving || isEmpty}>
          <Text style={styles.saveButtonText}>{saving ? '保存中...' : '保存する'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  date: { fontSize: 18, color: '#1D9E75', fontWeight: '600', marginHorizontal: 24, marginTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E8F8F3' },

  webview: { flex: 1 },
  photoList: { maxHeight: 120, paddingHorizontal: 12, paddingVertical: 8 },
  photoWrapper: { marginRight: 8, position: 'relative' },
  photo: { borderRadius: 8 },
  photoDelete: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 99, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  colorPalette: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fafafa', borderTopWidth: 0.5, borderTopColor: '#eee' },
  colorSwatch: { width: 30, height: 30, borderRadius: 15 },
  colorSwatchReset: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  colorResetText: { fontSize: 12, color: '#888' },
  toolbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', borderTopWidth: 0.5, borderTopColor: '#e0e0e0', paddingHorizontal: 6, paddingVertical: 4, gap: 2 },
  fmtBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fmtBtnActive: { backgroundColor: '#C8E6D4' },
  fmtTextActive: { color: '#1D9E75' },
  fmtBold: { fontSize: 16, fontWeight: '800', color: '#333' },
  fmtItalic: { fontSize: 16, fontStyle: 'italic', fontWeight: '600', color: '#333' },
  fmtUnderline: { fontSize: 16, textDecorationLine: 'underline', fontWeight: '600', color: '#333' },
  fmtText: { fontSize: 13, fontWeight: '700', color: '#333' },
  fmtDivider: { width: 1, height: 20, backgroundColor: '#e0e0e0', marginHorizontal: 2 },
  colorDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#E24B4A' },
  tagArea: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0.5 },
  tagSuggestion: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  tagSuggestionText: { fontSize: 12 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  tagChipText: { fontSize: 12, fontWeight: '600' },
  tagInput: { fontSize: 13, minWidth: 80, paddingVertical: 2 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 0.5 },
  cameraButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  saveButton: { flex: 1, padding: 14, borderRadius: 16, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#aaa' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
})
