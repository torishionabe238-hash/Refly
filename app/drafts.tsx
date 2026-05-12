import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useState, useCallback } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getDrafts, deleteDraft, Draft } from '../utils/drafts'

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}　${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function DraftsScreen() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useFocusEffect(useCallback(() => {
    getDrafts().then(d => { setDrafts(d); setLoading(false) })
  }, []))

  const handleDelete = (draft: Draft) => {
    Alert.alert('削除', 'この下書きを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: async () => {
          await deleteDraft(draft.id)
          setDrafts(prev => prev.filter(d => d.id !== draft.id))
        }
      }
    ])
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#1D9E75" /></View>

  if (drafts.length === 0) return (
    <View style={styles.center}>
      <Ionicons name="document-outline" size={52} color="#ccc" style={{ marginBottom: 12 }} />
      <Text style={styles.emptyText}>下書きはありません</Text>
      <Text style={styles.emptyHint}>日記タブで「下書き保存」してみよう</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={drafts}
        keyExtractor={d => d.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/draft/${item.id}`)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.date}>{formatDate(item.savedAt)}</Text>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color="#ccc" />
              </TouchableOpacity>
            </View>
            <Text style={styles.preview} numberOfLines={3}>
              {item.preview || '(内容なし)'}
            </Text>
            <View style={styles.cardFooter}>
              <Ionicons name="create-outline" size={13} color="#1D9E75" />
              <Text style={styles.editHint}>タップして編集</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, color: '#888', fontWeight: '500' },
  emptyHint: { fontSize: 13, color: '#bbb' },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  date: { fontSize: 12, color: '#aaa', fontWeight: '600' },
  deleteBtn: { padding: 4 },
  preview: { fontSize: 15, color: '#444', lineHeight: 24 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  editHint: { fontSize: 12, color: '#1D9E75', fontWeight: '500' },
})
