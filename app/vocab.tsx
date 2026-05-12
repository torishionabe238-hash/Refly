import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useState, useCallback, useMemo } from 'react'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../utils/supabase'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, Theme } from '../utils/theme'

type SavedWord = {
  id: string
  word: string
  reading: string
  meaning: string
  example: string
  created_at: string
}

export default function VocabScreen() {
  const theme = useTheme()
  const { accent, accentBg, card, text, sub, bg, border, dark } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])

  const [words, setWords] = useState<SavedWord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useFocusEffect(useCallback(() => {
    fetchWords()
  }, []))

  const fetchWords = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('saved_words')
      .select('*')
      .order('created_at', { ascending: false })
    setWords(data ?? [])
    setLoading(false)
  }

  const deleteWord = (item: SavedWord) => {
    Alert.alert('削除', `「${item.word}」を単語帳から削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: async () => {
          await supabase.from('saved_words').delete().eq('id', item.id)
          setWords(prev => prev.filter(w => w.id !== item.id))
        }
      }
    ])
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} size="large" /></View>

  if (words.length === 0) return (
    <View style={styles.center}>
      <Ionicons name="library-outline" size={56} color={sub} style={{ marginBottom: 8 }} />
      <Text style={styles.emptyText}>単語帳はまだ空です</Text>
      <Text style={styles.emptyHint}>日記の語彙提案から保存してみよう！</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={words}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const expanded = expandedIds.has(item.id)
          return (
            <TouchableOpacity
              style={[styles.card, dark && { borderWidth: 0.5, borderColor: border }]}
              activeOpacity={0.85}
              onPress={() => setExpandedIds(prev => {
                const next = new Set(prev)
                expanded ? next.delete(item.id) : next.add(item.id)
                return next
              })}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTopRow}>
                  <View style={styles.wordRow}>
                    <Text style={styles.word}>{item.word}</Text>
                    <Text style={styles.reading}>（{item.reading}）</Text>
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteWord(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={17} color={sub} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.meaning}>{item.meaning}</Text>
                <Text style={styles.tapHint}>{expanded ? '▲ 閉じる' : '▼ 使い方を見る'}</Text>
              </View>
              {expanded && (
                <View style={[styles.exampleBox, { backgroundColor: accentBg }]}>
                  <Text style={[styles.exampleLabel, { color: accent }]}>使い方</Text>
                  <Text style={styles.example}>「{item.example}」</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: t.bg },
    emptyText: { fontSize: 16, color: t.sub, fontWeight: '500' },
    emptyHint: { fontSize: 13, color: t.sub },
    list: { padding: 16, paddingBottom: 40 },
    card: {
      backgroundColor: t.card, borderRadius: 16, overflow: 'hidden',
    },
    cardTop: { padding: 16, gap: 4 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    wordRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flex: 1 },
    deleteBtn: { padding: 4 },
    word: { fontSize: 20, fontWeight: '700', color: t.text },
    reading: { fontSize: 13, color: t.sub },
    meaning: { fontSize: 14, color: t.text, opacity: 0.75 },
    tapHint: { fontSize: 11, color: t.accent, marginTop: 6, fontWeight: '600' },
    exampleBox: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
    exampleLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    example: { fontSize: 14, color: t.text, lineHeight: 22 },
    hint: { textAlign: 'center', fontSize: 11, color: t.sub, paddingBottom: 16 },
  })
}
