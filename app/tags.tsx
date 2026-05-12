import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, PanResponder, Animated } from 'react-native'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useFocusEffect, useNavigation } from 'expo-router'
import { supabase } from '../utils/supabase'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, Theme } from '../utils/theme'
import { getTagOrder, saveTagOrder, applyTagOrder } from '../utils/tags'

type TagInfo = { id: string; name: string; count: number }

const ROW_H = 56

function DraggableRow({ tag, isDragging, scaleAnim, onDragStart, onDragMove, onDragEnd, onRename, onDelete, accent, sub, accentBg, styles }: {
  tag: TagInfo; isDragging: boolean; scaleAnim: Animated.Value
  onDragStart: (id: string) => void
  onDragMove: (dy: number) => void
  onDragEnd: () => void
  onRename: (tag: TagInfo) => void; onDelete: (tag: TagInfo) => void
  accent: string; sub: string; accentBg: string; styles: ReturnType<typeof makeStyles>
}) {
  const tagRef = useRef(tag); tagRef.current = tag
  const startRef = useRef(onDragStart); startRef.current = onDragStart
  const moveRef = useRef(onDragMove); moveRef.current = onDragMove
  const endRef = useRef(onDragEnd); endRef.current = onDragEnd

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startRef.current(tagRef.current.id) },
    onPanResponderMove: (_, gs) => { moveRef.current(gs.dy) },
    onPanResponderRelease: () => { endRef.current() },
    onPanResponderTerminate: () => { endRef.current() },
  })).current

  return (
    <Animated.View style={[
      styles.row,
      isDragging && {
        transform: [{ scale: scaleAnim }],
        shadowColor: '#000', shadowOpacity: 0.2,
        shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
        elevation: 10, zIndex: 100,
      },
    ]}>
      <View style={[styles.tagChip, { backgroundColor: accentBg }]}>
        <Text style={[styles.tagName, { color: accent }]}>#{tag.name}</Text>
      </View>
      <View style={styles.countBadge}>
        <Text style={[styles.count, { color: sub }]}>{tag.count}件</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onRename(tag)}>
          <Ionicons name="pencil-outline" size={20} color={sub} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete(tag)}>
          <Ionicons name="trash-outline" size={20} color="#E24B4A" />
        </TouchableOpacity>
        <View {...panResponder.panHandlers} style={[styles.actionBtn, styles.dragHandle]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="reorder-three-outline" size={26} color={sub} />
        </View>
      </View>
    </Animated.View>
  )
}

export default function TagsScreen() {
  const theme = useTheme()
  const { accent, accentBg, card, text, sub, border, inputBg } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])
  const navigation = useNavigation()

  const [tags, setTags] = useState<TagInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTag, setEditingTag] = useState<TagInfo | null>(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName] = useState('')
  const [adding, setAdding] = useState(false)

  const scrollRef = useRef<ScrollView>(null)
  const dragFromRef = useRef<{ id: string; fromIndex: number } | null>(null)
  const dropIndexRef = useRef<number>(0)
  const tagsRef = useRef<TagInfo[]>([]); tagsRef.current = tags
  const scaleAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={{ padding: 8, marginRight: 4 }}>
          <Ionicons name="add" size={26} color={accent} />
        </TouchableOpacity>
      ),
    })
  }, [accent])

  // ドラッグ中はリストを即座に並べ替えて表示
  const displayTags = useMemo(() => {
    if (!draggingId || dropIndex === null) return tags
    const fromIndex = tags.findIndex(t => t.id === draggingId)
    if (fromIndex === -1 || fromIndex === dropIndex) return tags
    const next = [...tags]
    const [item] = next.splice(fromIndex, 1)
    next.splice(dropIndex, 0, item)
    return next
  }, [tags, draggingId, dropIndex])

  useFocusEffect(useCallback(() => { fetchTags() }, []))

  const fetchTags = async () => {
    setLoading(true)
    const [{ data: tagsData }, { data: diaryTagsData }] = await Promise.all([
      supabase.from('tags').select('id, name').order('name'),
      supabase.from('diary_tags').select('tag_id'),
    ])
    const countMap: Record<string, number> = {}
    ;(diaryTagsData ?? []).forEach((dt: any) => { countMap[dt.tag_id] = (countMap[dt.tag_id] ?? 0) + 1 })
    const tagList: TagInfo[] = (tagsData ?? []).map((t: any) => ({ id: t.id, name: t.name, count: countMap[t.id] ?? 0 }))
    const order = await getTagOrder()
    setTags(applyTagOrder(tagList, order))
    setLoading(false)
  }

  const handleDragStart = useCallback((id: string) => {
    const fromIndex = tagsRef.current.findIndex(t => t.id === id)
    dragFromRef.current = { id, fromIndex }
    dropIndexRef.current = fromIndex
    setDraggingId(id)
    setDropIndex(fromIndex)
    scrollRef.current?.setNativeProps({ scrollEnabled: false })
    Animated.spring(scaleAnim, { toValue: 1.05, tension: 260, friction: 28, useNativeDriver: true }).start()
  }, [])

  const handleDragMove = useCallback((dy: number) => {
    const from = dragFromRef.current
    if (!from) return
    const newDrop = Math.max(0, Math.min(tagsRef.current.length - 1, Math.round((from.fromIndex * ROW_H + dy) / ROW_H)))
    if (newDrop !== dropIndexRef.current) {
      dropIndexRef.current = newDrop
      setDropIndex(newDrop)
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    const from = dragFromRef.current
    const to = dropIndexRef.current

    scaleAnim.setValue(1)
    scrollRef.current?.setNativeProps({ scrollEnabled: true })
    dragFromRef.current = null
    setDraggingId(null)
    setDropIndex(null)

    if (from && from.fromIndex !== to) {
      setTags(prev => {
        const next = [...prev]
        const [item] = next.splice(from.fromIndex, 1)
        next.splice(to, 0, item)
        saveTagOrder(next.map(t => t.id))
        return next
      })
    }
  }, [])

  const addTag = async () => {
    const trimmed = addName.trim()
    if (!trimmed) return
    if (tags.some(t => t.name === trimmed)) { Alert.alert('エラー', 'そのタグ名はすでに存在します'); return }
    setAdding(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setAdding(false); return }
    const { error } = await supabase.from('tags').insert({ name: trimmed, user_id: session.user.id })
    setAdding(false)
    if (error) { Alert.alert('エラー', '追加に失敗しました'); return }
    setAddName('')
    setShowAddModal(false)
    fetchTags()
  }

  const startRename = (tag: TagInfo) => { setEditingTag(tag); setNewName(tag.name) }

  const confirmRename = async () => {
    if (!editingTag) return
    const trimmed = newName.trim()
    if (!trimmed || trimmed === editingTag.name) { setEditingTag(null); return }
    if (tags.some(t => t.name === trimmed && t.id !== editingTag.id)) { Alert.alert('エラー', 'そのタグ名はすでに存在します'); return }
    setSaving(true)
    const { error } = await supabase.from('tags').update({ name: trimmed }).eq('id', editingTag.id)
    setSaving(false)
    if (error) { Alert.alert('エラー', '変更に失敗しました'); return }
    setEditingTag(null)
    fetchTags()
  }

  const deleteTag = (tag: TagInfo) => {
    Alert.alert(`#${tag.name} を削除`, `${tag.count}件の日記からこのタグを削除します。この操作は元に戻せません。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: async () => {
          await supabase.from('diary_tags').delete().eq('tag_id', tag.id)
          const { data: affected } = await supabase.from('diaries').select('id, tags')
          await Promise.all(
            (affected ?? [])
              .filter((d: any) => Array.isArray(d.tags) && d.tags.includes(tag.name))
              .map((d: any) => supabase.from('diaries').update({ tags: d.tags.filter((t: string) => t !== tag.name) }).eq('id', d.id))
          )
          const { error } = await supabase.from('tags').delete().eq('id', tag.id)
          if (error) { Alert.alert('エラー', '削除に失敗しました'); return }
          fetchTags()
        },
      },
    ])
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} size="large" /></View>

  if (tags.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="pricetags-outline" size={48} color={sub} />
        <Text style={styles.emptyText}>タグがありません</Text>
        <Text style={styles.emptyHint}>日記を書くときにタグを追加してみよう</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.list}>
        {displayTags.map(tag => (
          <DraggableRow
            key={tag.id}
            tag={tag}
            isDragging={draggingId === tag.id}
            scaleAnim={scaleAnim}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onRename={startRename}
            onDelete={deleteTag}
            accent={accent} sub={sub} accentBg={accentBg} styles={styles}
          />
        ))}
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { setShowAddModal(false); setAddName('') }}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { backgroundColor: card }]}>
              <Text style={[styles.modalTitle, { color: text }]}>タグを追加</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: text }]}
                placeholder="タグ名を入力"
                placeholderTextColor={sub}
                value={addName}
                onChangeText={setAddName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={addTag}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: inputBg }]} onPress={() => { setShowAddModal(false); setAddName('') }}>
                  <Text style={[styles.modalBtnText, { color: sub }]}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: accent }, (!addName.trim() || adding) && { opacity: 0.5 }]}
                  onPress={addTag} disabled={!addName.trim() || adding}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>{adding ? '追加中...' : '追加する'}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!editingTag} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setEditingTag(null)}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { backgroundColor: card }]}>
              <Text style={[styles.modalTitle, { color: text }]}>タグ名を変更</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: text }]}
                value={newName} onChangeText={setNewName}
                autoFocus selectTextOnFocus returnKeyType="done" onSubmitEditing={confirmRename}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: inputBg }]} onPress={() => setEditingTag(null)}>
                  <Text style={[styles.modalBtnText, { color: sub }]}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: accent }, saving && { opacity: 0.6 }]}
                  onPress={confirmRename} disabled={saving}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>{saving ? '変更中...' : '変更する'}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: t.bg },
    emptyText: { fontSize: 16, color: t.sub, fontWeight: '500', marginTop: 12 },
    emptyHint: { fontSize: 13, color: t.sub },
    list: { paddingVertical: 8 },
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, height: ROW_H,
      backgroundColor: t.card,
      borderBottomWidth: 0.5, borderBottomColor: t.border,
      gap: 10,
    },
    tagChip: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
    tagName: { fontSize: 16, fontWeight: '700' },
    countBadge: { flex: 1 },
    count: { fontSize: 13 },
    actions: { flexDirection: 'row', gap: 4 },
    actionBtn: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    dragHandle: { opacity: 0.5 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
    modalCard: { width: '85%', borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
    modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 20 },
    modalButtons: { flexDirection: 'row', gap: 10 },
    modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontWeight: '600' },
  })
}
