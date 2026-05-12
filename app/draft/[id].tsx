import { View, Text, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useState, useRef, useEffect } from 'react'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import WebView from 'react-native-webview'
import { supabase } from '../../utils/supabase'
import { getDrafts, saveDraft, deleteDraft, updateDraft, Draft } from '../../utils/drafts'

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
<div id="editor" contenteditable="true" data-placeholder="下書きを編集..."></div>
<script>
var editor = document.getElementById('editor');
function sendState() {
  var block = document.queryCommandValue('formatBlock').toLowerCase();
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'state',
    bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'), h1: block==='h1', h2: block==='h2' }));
}
function execCmd(cmd, value) {
  editor.focus();
  if (cmd === 'formatBlock') {
    var cur = document.queryCommandValue('formatBlock').toLowerCase();
    document.execCommand('formatBlock', false, cur===value.toLowerCase() ? 'p' : value);
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

export default function DraftEditor() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [contentHtml, setContentHtml] = useState('')
  const [fmt, setFmt] = useState({ bold: false, italic: false, underline: false, h1: false, h2: false })
  const [showColors, setShowColors] = useState(false)
  const [saving, setSaving] = useState(false)
  const webViewRef = useRef<WebView>(null)
  const router = useRouter()
  const navigation = useNavigation()

  useEffect(() => {
    getDrafts().then(drafts => {
      const d = drafts.find(d => d.id === id)
      if (!d) { router.back(); return }
      setDraft(d)
      setContentHtml(d.contentHtml)
    })
  }, [])

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleDelete} style={{ padding: 8, marginRight: 4 }}>
          <Ionicons name="trash-outline" size={20} color="#E24B4A" />
        </TouchableOpacity>
      )
    })
  }, [draft])

  const onLoad = () => {
    if (draft?.contentHtml) {
      webViewRef.current?.injectJavaScript(`setContent(${JSON.stringify(draft.contentHtml)}); true;`)
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

  const handleSaveDraft = async () => {
    if (!draft) return
    const updated = updateDraft(draft, contentHtml)
    await saveDraft(updated)
    setDraft(updated)
    Alert.alert('完了', '下書きを更新しました')
  }

  const handleSaveAsDiary = async () => {
    const plain = contentHtml.replace(/<[^>]*>/g, '').trim()
    if (!plain) { Alert.alert('エラー', '内容を入力してください'); return }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { Alert.alert('エラー', 'ログインが必要です'); return }
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0]
      const { error } = await supabase.from('diaries').insert({
        user_id: session.user.id,
        title: dateStr,
        content: contentHtml,
        date: dateStr,
        photos: [],
      })
      if (error) throw error
      if (draft) await deleteDraft(draft.id)
      Alert.alert('完了', '日記として保存しました！', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/calendar') }
      ])
    } catch (_e) {
      Alert.alert('エラー', '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    Alert.alert('削除', 'この下書きを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: async () => {
          if (draft) await deleteDraft(draft.id)
          router.back()
        }
      }
    ])
  }

  if (!draft) return null

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <WebView
        ref={webViewRef}
        source={{ html: EDITOR_HTML }}
        style={{ flex: 1 }}
        onLoad={onLoad}
        onMessage={onMessage}
        scrollEnabled
        keyboardDisplayRequiresUserAction={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
      />

      {showColors && (
        <View style={styles.colorPalette}>
          {COLORS.map(c => (
            <TouchableOpacity key={c} style={[styles.colorSwatch, { backgroundColor: c }]} onPress={() => exec('foreColor', c)} />
          ))}
          <TouchableOpacity style={styles.colorReset} onPress={() => exec('foreColor', '#333333')}>
            <Text style={{ fontSize: 11, color: '#888' }}>戻す</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.toolbar}>
        <TouchableOpacity style={[styles.fmtBtn, fmt.bold && styles.fmtActive]} onPress={() => exec('bold')}><Text style={[styles.fmtBold, fmt.bold && styles.fmtTextActive]}>B</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.italic && styles.fmtActive]} onPress={() => exec('italic')}><Text style={[styles.fmtItalic, fmt.italic && styles.fmtTextActive]}>I</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.underline && styles.fmtActive]} onPress={() => exec('underline')}><Text style={[styles.fmtUnderline, fmt.underline && styles.fmtTextActive]}>U</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.h1 && styles.fmtActive]} onPress={() => exec('formatBlock', 'h1')}><Text style={[styles.fmtText, fmt.h1 && styles.fmtTextActive]}>H1</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.h2 && styles.fmtActive]} onPress={() => exec('formatBlock', 'h2')}><Text style={[styles.fmtText, fmt.h2 && styles.fmtTextActive]}>H2</Text></TouchableOpacity>
        <View style={styles.fmtDivider} />
        <TouchableOpacity style={[styles.fmtBtn, showColors && styles.fmtActive]} onPress={() => setShowColors(v => !v)}>
          <View style={styles.colorDot} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.fmtBtn} onPress={() => exec('undo')}><Ionicons name="arrow-undo-outline" size={17} color="#555" /></TouchableOpacity>
        <TouchableOpacity style={styles.fmtBtn} onPress={() => exec('redo')}><Ionicons name="arrow-redo-outline" size={17} color="#555" /></TouchableOpacity>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.draftBtn} onPress={handleSaveDraft}>
          <Ionicons name="save-outline" size={16} color="#1D9E75" />
          <Text style={styles.draftBtnText}>更新</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSaveAsDiary} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? '保存中...' : '日記として保存'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  colorPalette: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fafafa', borderTopWidth: 0.5, borderTopColor: '#eee' },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  colorReset: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  toolbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', borderTopWidth: 0.5, borderTopColor: '#e0e0e0', paddingHorizontal: 6, paddingVertical: 4, gap: 2 },
  fmtBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fmtActive: { backgroundColor: '#C8E6D4' },
  fmtBold: { fontSize: 16, fontWeight: '800', color: '#333' },
  fmtItalic: { fontSize: 16, fontStyle: 'italic', fontWeight: '600', color: '#333' },
  fmtUnderline: { fontSize: 16, textDecorationLine: 'underline', fontWeight: '600', color: '#333' },
  fmtText: { fontSize: 13, fontWeight: '700', color: '#333' },
  fmtTextActive: { color: '#1D9E75' },
  fmtDivider: { width: 1, height: 20, backgroundColor: '#e0e0e0', marginHorizontal: 2 },
  colorDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#E24B4A' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#f0f0f0' },
  draftBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: '#1D9E75' },
  draftBtnText: { fontSize: 14, color: '#1D9E75', fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: '#1D9E75', padding: 14, borderRadius: 14, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#aaa' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
