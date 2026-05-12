import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useState, useCallback, useMemo } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { supabase } from '../../utils/supabase'
import { Ionicons } from '@expo/vector-icons'
import { getDrafts } from '../../utils/drafts'
import { useTheme, Theme } from '../../utils/theme'

export default function SettingsScreen() {
  const theme = useTheme()
  const { accent, accentBg, card, text, sub, border } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])
  const router = useRouter()

  const [streak, setStreak] = useState(0)
  const [totalDiaries, setTotalDiaries] = useState(0)
  const [savedVocabCount, setSavedVocabCount] = useState(0)
  const [draftCount, setDraftCount] = useState(0)

  useFocusEffect(useCallback(() => { fetchAll() }, []))

  const fetchAll = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const [diaryRes, vocabRes] = await Promise.all([
        supabase.from('diaries').select('date').eq('user_id', session.user.id),
        supabase.from('saved_words').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id),
      ])
      const dates = diaryRes.data ?? []
      setTotalDiaries(dates.length)
      setSavedVocabCount(vocabRes.count ?? 0)
      const dateSet = new Set(dates.map((d: { date: string }) => d.date))
      let s = 0
      const d = new Date()
      while (true) {
        const iso = d.toISOString().split('T')[0]
        if (!dateSet.has(iso)) break
        s++
        d.setDate(d.getDate() - 1)
      }
      setStreak(s)
      getDrafts().then(d => setDraftCount(d.length))
    } catch (_e) {}
  }

  const MENU = [
    { label: 'エピソード',  sub: 'エピソードトーク一覧', icon: 'mic' as const,           route: '/episodes' },
    { label: '単語帳',      sub: '保存した語彙を復習',    icon: 'library' as const,       route: '/vocab'    },
    { label: 'タグ管理',    sub: 'タグの並び替え・編集',  icon: 'pricetags' as const,     route: '/tags'     },
    { label: '下書き',      sub: draftCount > 0 ? `${draftCount}件あります` : 'なし',
                                                           icon: 'document-text' as const, route: '/drafts'   },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

      {/* 統計 */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}><Ionicons name="flame-outline" size={11} color={sub} /> 連続日数</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={() => router.push('/(tabs)/list')}>
          <Text style={styles.statValue}>{totalDiaries}</Text>
          <Text style={styles.statLabel}><Ionicons name="document-text-outline" size={11} color={sub} /> 日記数</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={() => router.push('/vocab')}>
          <Text style={styles.statValue}>{savedVocabCount}</Text>
          <Text style={styles.statLabel}><Ionicons name="library-outline" size={11} color={sub} /> 保存語彙</Text>
        </TouchableOpacity>
      </View>

      {/* メニューグリッド */}
      <View style={styles.grid}>
        {MENU.map(item => (
          <TouchableOpacity key={item.route} style={[styles.gridCard, { backgroundColor: card }]} onPress={() => router.push(item.route as any)} activeOpacity={0.75}>
            <View style={[styles.gridIcon, { backgroundColor: accentBg }]}>
              <Ionicons name={`${item.icon}-outline` as any} size={24} color={accent} />
            </View>
            <Text style={[styles.gridLabel, { color: text }]}>{item.label}</Text>
            <Text style={[styles.gridSub, { color: sub }]}>{item.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </ScrollView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },

    statsCard: {
      flexDirection: 'row',
      backgroundColor: t.card,
      marginHorizontal: 16, marginTop: 24,
      borderRadius: 18, paddingVertical: 20,
    },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statValue: { fontSize: 26, fontWeight: '700', color: t.accent },
    statLabel: { fontSize: 11, color: t.sub, fontWeight: '500' },
    statDivider: { width: 1, backgroundColor: t.border, marginVertical: 4 },

    grid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10,
      marginHorizontal: 16, marginTop: 16,
    },
    gridCard: {
      width: '47.5%', borderRadius: 18,
      padding: 18, gap: 8,
    },
    gridIcon: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    gridLabel: { fontSize: 15, fontWeight: '700' },
    gridSub: { fontSize: 12, lineHeight: 16 },
  })
}
