import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Platform } from 'react-native'
import { useState, useMemo } from 'react'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../utils/supabase'
import BottomSheet from '../components/BottomSheet'
import { useTheme, Theme } from '../utils/theme'

const MASTRA_URL = 'http://10.1.62.38:4111'

type DiaryEntry = { date: string; content: string }
type Step = 'idle' | 'analyzing' | 'preview' | 'saving' | 'done'

const parseResult = (text: string): DiaryEntry[] => {
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e: any) => e.date && e.content &&
      typeof e.date === 'string' && typeof e.content === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.content.trim().length > 0
    )
  } catch (_e) { return [] }
}

export default function ImportScreen() {
  const theme = useTheme()
  const { accent, bg, card, text, sub, border, inputBg } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])

  const [step, setStep] = useState<Step>('idle')
  const [fileName, setFileName] = useState('')
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [savedCount, setSavedCount] = useState(0)

  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editContent, setEditContent] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  const openEdit = (index: number) => {
    setEditIndex(index)
    setEditDate(entries[index].date)
    setEditContent(entries[index].content)
    setShowDatePicker(false)
  }

  const closeEdit = () => { setEditIndex(null); setShowDatePicker(false) }

  const onDateChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false)
    if (selected) setEditDate(selected.toISOString().split('T')[0])
  }

  const saveEdit = () => {
    if (!editDate.trim() || !editContent.trim()) {
      Alert.alert('エラー', '日付と内容を入力してください'); return
    }
    setEntries(prev => prev.map((e, i) =>
      i === editIndex ? { date: editDate.trim(), content: editContent.trim() } : e
    ))
    closeEdit()
  }

  const deleteEntry = () => {
    Alert.alert('削除', 'このエントリーを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => { setEntries(prev => prev.filter((_, i) => i !== editIndex)); closeEdit() } },
    ])
  }

  const pickAndAnalyze = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/*', 'application/json', '*/*'], copyToCacheDirectory: true })
      if (result.canceled) return
      const file = result.assets[0]
      setFileName(file.name)
      setStep('analyzing')
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: 'utf8' })
      const res = await fetch(`${MASTRA_URL}/api/agents/import-agent/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content }], threadId: `import-${Date.now()}`, resourceId: 'refly-user' }),
      })
      const data = await res.json()
      const raw = data.text ?? data.content ?? data.output ?? ''
      const parsed = parseResult(raw)
      if (parsed.length === 0) {
        Alert.alert('解析失敗', '日記エントリーを抽出できませんでした。\n日付と内容が含まれるファイルか確認してください。')
        setStep('idle'); return
      }
      setEntries(parsed.sort((a, b) => b.date.localeCompare(a.date)))
      setStep('preview')
    } catch (_e) {
      Alert.alert('エラー', 'ファイルの読み込みに失敗しました')
      setStep('idle')
    }
  }

  const saveEntries = async () => {
    setStep('saving')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { Alert.alert('エラー', 'ログインが必要です'); setStep('preview'); return }
      const { error } = await supabase.from('diaries').insert(
        entries.map(e => ({ user_id: session.user.id, title: e.date, content: e.content, date: e.date, photos: [] }))
      )
      if (error) throw error
      setSavedCount(entries.length)
      setStep('done')
    } catch (_e) {
      Alert.alert('エラー', '保存に失敗しました')
      setStep('preview')
    }
  }

  const reset = () => { setStep('idle'); setFileName(''); setEntries([]); setSavedCount(0) }

  if (step === 'idle') return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Ionicons name="download-outline" size={56} color={accent} style={{ marginBottom: 16 }} />
        <Text style={styles.heroTitle}>日記を取り込む</Text>
        <Text style={styles.heroDesc}>テキストファイルや CSV など、{'\n'}日付と内容が書かれていれば{'\n'}AIが自動で解析して登録します。</Text>
      </View>
      <TouchableOpacity style={styles.primaryButton} onPress={pickAndAnalyze}>
        <Text style={styles.primaryButtonText}>ファイルを選択する</Text>
      </TouchableOpacity>
      <View style={styles.supportedFormats}>
        <Text style={styles.supportedTitle}>対応フォーマット例</Text>
        {['2024年1月15日\n今日は〇〇した...', '2024/01/15 今日は〇〇した...', 'date,content\n2024-01-15,今日は〇〇した...'].map((ex, i) => (
          <View key={i} style={styles.formatCard}><Text style={styles.formatText}>{ex}</Text></View>
        ))}
      </View>
    </View>
  )

  if (step === 'analyzing') return (
    <View style={[styles.container, styles.center]}>
      <ActivityIndicator color={accent} size="large" />
      <Text style={styles.loadingTitle}>AIが解析中...</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <Ionicons name="document-outline" size={14} color={sub} />
        <Text style={styles.loadingFile}>{fileName}</Text>
      </View>
      <Text style={styles.loadingDesc}>日付と内容を読み取っています</Text>
    </View>
  )

  if (step === 'preview') return (
    <View style={styles.container}>
      <View style={styles.previewHeader}>
        <Text style={styles.previewTitle}>解析結果</Text>
        <View style={[styles.previewBadge, { backgroundColor: accent }]}><Text style={styles.previewBadgeText}>{entries.length}件</Text></View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Ionicons name="document-outline" size={13} color={sub} />
        <Text style={styles.previewFile}>{fileName}　タップして編集できます</Text>
      </View>

      <ScrollView style={styles.previewList} showsVerticalScrollIndicator={false}>
        {entries.map((entry, i) => (
          <TouchableOpacity key={i} style={styles.entryCard} onPress={() => openEdit(i)}>
            <View style={[styles.entryAccent, { backgroundColor: accent }]} />
            <View style={styles.entryBody}>
              <Text style={[styles.entryDate, { color: accent }]}>{entry.date}</Text>
              <Text style={styles.entryContent} numberOfLines={2}>{entry.content}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.previewActions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={reset}>
          <Text style={[styles.secondaryButtonText, { color: accent }]}>やり直す</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={saveEntries}>
          <Text style={styles.primaryButtonText}>すべて保存する</Text>
        </TouchableOpacity>
      </View>

      <BottomSheet visible={editIndex !== null} onClose={closeEdit} title="エントリーを編集" hideCloseButton>
        <ScrollView style={styles.editScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.editLabel}>日付</Text>
          <TouchableOpacity style={styles.dateTrigger} onPress={() => setShowDatePicker(v => !v)}>
            <Text style={[styles.dateTriggerText, { color: text }]}>{editDate || '日付を選択'}</Text>
            <Ionicons name="calendar-outline" size={18} color={sub} />
          </TouchableOpacity>
          {showDatePicker && (
            <View style={styles.datePickerWrapper}>
              <DateTimePicker
                value={editDate ? new Date(editDate) : new Date()}
                mode="date" display="spinner" onChange={onDateChange}
                maximumDate={new Date()} locale="ja"
                textColor={text} style={{ height: 160 }}
              />
              <TouchableOpacity style={styles.datePickerDone} onPress={() => setShowDatePicker(false)}>
                <Text style={[styles.datePickerDoneText, { color: accent }]}>完了</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.editLabel}>内容</Text>
          <TextInput
            style={styles.editInputMulti} value={editContent} onChangeText={setEditContent}
            placeholder="日記の内容..." placeholderTextColor={sub}
            multiline textAlignVertical="top"
          />
          <TouchableOpacity style={styles.editSaveBtn} onPress={saveEdit}>
            <Text style={styles.editSaveBtnText}>変更を保存</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editDeleteBtn} onPress={deleteEntry}>
            <Text style={styles.editDeleteBtnText}>このエントリーを削除</Text>
          </TouchableOpacity>
          <View style={{ height: 16 }} />
        </ScrollView>
      </BottomSheet>
    </View>
  )

  if (step === 'saving') return (
    <View style={[styles.container, styles.center]}>
      <ActivityIndicator color={accent} size="large" />
      <Text style={styles.loadingTitle}>保存中...</Text>
      <Text style={styles.loadingDesc}>{entries.length}件の日記を登録しています</Text>
    </View>
  )

  return (
    <View style={[styles.container, styles.center]}>
      <Ionicons name="checkmark-circle" size={64} color={accent} style={{ marginBottom: 16 }} />
      <Text style={styles.doneTitle}>{savedCount}件の日記を登録しました</Text>
      <Text style={styles.doneDesc}>カレンダーや一覧から確認できます</Text>
      <TouchableOpacity style={[styles.primaryButton, { marginTop: 32 }]} onPress={reset}>
        <Text style={styles.primaryButtonText}>続けて取り込む</Text>
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    center: { justifyContent: 'center', alignItems: 'center', padding: 32 },

    hero: { alignItems: 'center', padding: 32, paddingBottom: 24 },
    heroTitle: { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 12 },
    heroDesc: { fontSize: 15, color: t.sub, textAlign: 'center', lineHeight: 24 },

    primaryButton: {
      backgroundColor: t.accent, marginHorizontal: 24, padding: 16,
      borderRadius: 16, alignItems: 'center',
    },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    secondaryButton: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1.5, borderColor: t.accent },
    secondaryButtonText: { fontSize: 15, fontWeight: '600' },

    supportedFormats: { padding: 24, gap: 8 },
    supportedTitle: { fontSize: 13, color: t.sub, fontWeight: '600', marginBottom: 4, letterSpacing: 0.5 },
    formatCard: { backgroundColor: t.card, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: t.border },
    formatText: { fontSize: 12, color: t.sub, lineHeight: 18 },

    loadingTitle: { fontSize: 18, fontWeight: '700', color: t.accent, marginTop: 20 },
    loadingFile: { fontSize: 13, color: t.sub, marginTop: 8 },
    loadingDesc: { fontSize: 14, color: t.sub, marginTop: 6 },

    previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, paddingBottom: 4 },
    previewTitle: { fontSize: 18, fontWeight: '700', color: t.text },
    previewBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
    previewBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    previewFile: { fontSize: 12, color: t.sub },
    previewList: { flex: 1, paddingHorizontal: 16 },

    entryCard: { flexDirection: 'row', backgroundColor: t.card, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
    entryAccent: { width: 4 },
    entryBody: { flex: 1, padding: 12, gap: 4 },
    entryDate: { fontSize: 12, fontWeight: '700' },
    entryContent: { fontSize: 14, color: t.text, lineHeight: 20 },

    previewActions: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 32, backgroundColor: t.bg },

    editScroll: { paddingHorizontal: 20 },
    editLabel: { fontSize: 13, fontWeight: '600', color: t.sub, marginTop: 16, marginBottom: 6 },
    dateTrigger: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: t.inputBg, borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 14,
    },
    dateTriggerText: { fontSize: 15 },
    datePickerWrapper: { backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.border, overflow: 'hidden', marginBottom: 4 },
    datePickerDone: { alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: t.border },
    datePickerDoneText: { fontWeight: '700', fontSize: 15 },
    editInputMulti: {
      backgroundColor: t.inputBg, borderWidth: 1, borderColor: t.border,
      borderRadius: 12, padding: 12, fontSize: 15, color: t.text,
      height: 140, textAlignVertical: 'top',
    },
    editSaveBtn: { backgroundColor: t.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 20 },
    editSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    editDeleteBtn: { borderWidth: 1, borderColor: '#E24B4A', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 10 },
    editDeleteBtnText: { color: '#E24B4A', fontSize: 15, fontWeight: '600' },

    doneTitle: { fontSize: 20, fontWeight: '700', color: t.text, textAlign: 'center' },
    doneDesc: { fontSize: 14, color: t.sub, marginTop: 8 },
  })
}
