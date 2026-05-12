import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useState, useCallback, useMemo } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { supabase } from '../utils/supabase'
import AuroraGradient from '../components/AuroraGradient'
import { useTheme, Theme } from '../utils/theme'

type Episode = {
  id: string
  date: string
  episode_text: string
  points: string[]
  diary_count: number
  created_at: string
}

const formatEpisodeDate = (dateStr: string) => {
  if (dateStr.includes('〜')) {
    const [s, e] = dateStr.split('〜').map(d => new Date(d))
    return `${s.getMonth() + 1}/${s.getDate()} 〜 ${e.getMonth() + 1}/${e.getDate()}`
  }
  const d = new Date(dateStr)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`
}

export default function EpisodesScreen() {
  const theme = useTheme()
  const { accent, gradientEnd, bg, text, sub } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])
  const router = useRouter()

  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(useCallback(() => {
    fetchEpisodes()
  }, []))

  const fetchEpisodes = async () => {
    const { data } = await supabase.from('episodes').select('*').order('created_at', { ascending: false })
    setEpisodes(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }

  const onRefresh = () => { setRefreshing(true); fetchEpisodes() }

  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} size="large" /></View>

  if (episodes.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>まだエピソードがありません</Text>
        <Text style={styles.emptyHint}>カレンダーからエピソード化してみよう！</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={episodes}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />}
        renderItem={({ item }) => (
          <AuroraGradient colors={[accent, gradientEnd]} style={styles.cardGradient}>
            <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => router.push(`/episode/${item.id}`)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>{formatEpisodeDate(item.date)}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>日記{item.diary_count}件</Text>
                </View>
              </View>
              <Text style={styles.episodeText} numberOfLines={4}>{item.episode_text}</Text>
              {item.points.length > 0 && (
                <View style={styles.pointsPreview}>
                  {item.points.slice(0, 2).map((p, i) => (
                    <Text key={i} style={styles.pointText} numberOfLines={1}>・{p}</Text>
                  ))}
                  {item.points.length > 2 && <Text style={styles.pointMore}>他{item.points.length - 2}件のポイント</Text>}
                </View>
              )}
            </TouchableOpacity>
          </AuroraGradient>
        )}
      />
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: t.bg },
    emptyText: { fontSize: 16, color: t.sub, fontWeight: '500' },
    emptyHint: { fontSize: 14, color: t.sub },
    listContent: { padding: 16, paddingBottom: 32 },
    cardGradient: { borderRadius: 18, padding: 1.5 },
    card: { backgroundColor: t.accentBg, borderRadius: 17, padding: 16, gap: 10 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardDate: { fontSize: 14, fontWeight: '700', color: t.accent },
    countBadge: { backgroundColor: t.accent, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
    countText: { fontSize: 11, color: '#fff', fontWeight: '600' },
    episodeText: { fontSize: 14, color: t.text, lineHeight: 22 },
    pointsPreview: { gap: 3, borderTopWidth: 0.5, borderTopColor: t.accentBorder, paddingTop: 8 },
    pointText: { fontSize: 12, color: t.accent },
    pointMore: { fontSize: 11, color: t.accentLight, marginTop: 2 },
  })
}
