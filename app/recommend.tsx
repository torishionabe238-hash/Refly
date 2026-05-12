import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import MaskedView from '@react-native-masked-view/masked-view'
import AuroraGradient from '../components/AuroraGradient'
import { supabase } from '../utils/supabase'
import ThinkingIndicator from '../components/ThinkingIndicator'
import { stripHtml } from './diary/[id]'
import { useTheme, Theme } from '../utils/theme'

const MASTRA_URL = process.env.EXPO_PUBLIC_MASTRA_URL ?? 'http://10.1.62.38:4111'

type Recommendation = {
  diary_id: string
  hook: string
  reason: string
  category: '笑える' | '共感' | '驚き' | '感動' | '学び'
}

type DiarySnippet = {
  id: string
  date: string
  content: string
}

type CategoryConfig = { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string }
const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  '笑える': { icon: 'happy-outline',  color: '#16A34A', bg: '#DCFCE7' },
  '共感':   { icon: 'heart-outline',  color: '#2563EB', bg: '#DBEAFE' },
  '驚き':   { icon: 'flash-outline',  color: '#D97706', bg: '#FEF3C7' },
  '感動':   { icon: 'rose-outline',   color: '#DB2777', bg: '#FCE7F3' },
  '学び':   { icon: 'bulb-outline',   color: '#7C3AED', bg: '#EDE9FE' },
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`
}

export default function RecommendScreen() {
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [diaryMap, setDiaryMap] = useState<Record<string, DiarySnippet>>({})
  const [analyzed, setAnalyzed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const since = new Date()
      since.setDate(since.getDate() - 90)
      const { data, error: fetchError } = await supabase
        .from('diaries')
        .select('id, date, content')
        .gte('date', since.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(50)

      if (fetchError || !data || data.length === 0) {
        setError('日記が見つかりませんでした。先に日記を書いてみましょう！')
        return
      }

      const map: Record<string, DiarySnippet> = {}
      data.forEach((d: any) => { map[d.id] = d })
      setDiaryMap(map)

      const diariesForAI = data.map((d: any) => ({
        id: d.id,
        date: d.date,
        content: stripHtml(d.content).slice(0, 200),
      }))

      const diaryList = diariesForAI
        .map((d: any) => `[ID:${d.id}] ${d.date}\n${d.content}`)
        .join('\n\n---\n\n')

      const res = await fetch(`${MASTRA_URL}/api/agents/recommend-agent/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: diaryList }],
          threadId: `recommend-${Date.now()}`,
          resourceId: 'refly-user',
        }),
      })
      const aiData = await res.json()
      const raw = aiData.text ?? aiData.content ?? aiData.output ?? ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null

      if (!result?.recommendations) {
        setError('AIの分析に失敗しました。もう一度試してください。')
        return
      }

      setRecommendations(result.recommendations)
      setAnalyzed(true)
    } finally {
      setLoading(false)
    }
  }

  const { accent, card, text, sub, border, bg } = theme

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!analyzed && !loading && (
          <View style={styles.introSection}>
            <View style={styles.introIconWrap}>
              <MaskedView maskElement={<Ionicons name="leaf" size={36} color="#000" />}>
                <LinearGradient
                  colors={[theme.accent, theme.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 36, height: 36 }}
                />
              </MaskedView>
            </View>
            <Text style={styles.introTitle}>話のタネを見つけよう</Text>
            <Text style={styles.introDesc}>
              過去90日間の日記をAIが分析して、{'\n'}
              友人や職場で話しやすいエピソードを{'\n'}
              ピックアップします。
            </Text>
            <AuroraGradient colors={[theme.accent, theme.gradientEnd]} style={styles.analyzeBtn}>
              <TouchableOpacity style={styles.analyzeBtnInner} onPress={analyze} activeOpacity={0.8}>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.analyzeBtnText}>AIに分析してもらう</Text>
              </TouchableOpacity>
            </AuroraGradient>
          </View>
        )}

        {loading && (
          <View style={styles.loadingSection}>
            <ThinkingIndicator steps={[
              '過去の日記を読んでいます...',
              '面白いエピソードを探しています...',
              '笑えるネタを見つけています...',
              '共感できる話を選んでいます...',
              '話のタネを整理しています...',
              'もう少しで完成です...',
            ]} />
          </View>
        )}

        {error && (
          <View style={styles.errorSection}>
            <Ionicons name="alert-circle-outline" size={40} color={sub} />
            <Text style={[styles.errorText, { color: sub }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { borderColor: accent }]} onPress={analyze}>
              <Text style={[styles.retryBtnText, { color: accent }]}>もう一度試す</Text>
            </TouchableOpacity>
          </View>
        )}

        {analyzed && recommendations.length === 0 && (
          <View style={styles.emptySection}>
            <Ionicons name="search-outline" size={48} color={sub} />
            <Text style={[styles.introTitle, { color: text }]}>ネタが見つかりませんでした</Text>
            <Text style={[styles.introDesc, { color: sub }]}>もっと具体的な出来事を日記に書いてみましょう！</Text>
          </View>
        )}

        {analyzed && recommendations.length > 0 && (
          <>
            <View style={styles.resultHeader}>
              <Text style={[styles.resultTitle, { color: text }]}>
                話せるネタが{recommendations.length}件見つかりました！
              </Text>
              <TouchableOpacity onPress={() => { setAnalyzed(false); setRecommendations([]) }}>
                <Text style={[styles.reanalyzeText, { color: accent }]}>再分析</Text>
              </TouchableOpacity>
            </View>

            {recommendations.map((rec, i) => {
              const diary = diaryMap[rec.diary_id]
              const cfg = CATEGORY_CONFIG[rec.category] ?? CATEGORY_CONFIG['学び']
              const preview = diary ? stripHtml(diary.content).slice(0, 100) : ''
              return (
                <View key={i} style={[styles.card, { backgroundColor: card, borderColor: border }]}>
                  <View style={styles.cardTop}>
                    <View style={[styles.categoryBadge, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                      <Text style={[styles.categoryLabel, { color: cfg.color }]}>{rec.category}</Text>
                    </View>
                    {diary && (
                      <Text style={[styles.cardDate, { color: sub }]}>{formatDate(diary.date)}</Text>
                    )}
                  </View>

                  <Text style={[styles.hookText, { color: text }]}>{rec.hook}</Text>
                  <Text style={[styles.previewText, { color: sub }]} numberOfLines={2}>{preview}</Text>
                  <View style={[styles.reasonRow, { backgroundColor: theme.inputBg }]}>
                    <Ionicons name="bulb-outline" size={14} color={accent} />
                    <Text style={[styles.reasonText, { color: theme.accent }]}>{rec.reason}</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.detailBtn, { backgroundColor: theme.accentBg, borderColor: theme.accentBorder }]}
                    onPress={() => router.push(`/diary/${rec.diary_id}`)}
                  >
                    <Text style={[styles.detailBtnText, { color: accent }]}>日記を見る・エピソード化</Text>
                    <Ionicons name="chevron-forward" size={14} color={accent} />
                  </TouchableOpacity>
                </View>
              )
            })}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { padding: 20, paddingBottom: 40 },

    introSection: { alignItems: 'center', paddingVertical: 40, gap: 16 },
    introIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: t.accentBg, alignItems: 'center', justifyContent: 'center' },
    introIcon: { fontSize: 36 },
    introTitle: { fontSize: 20, fontWeight: '700', color: t.text },
    introDesc: { fontSize: 14, color: t.sub, textAlign: 'center', lineHeight: 22 },
    analyzeBtn: { borderRadius: 99, marginTop: 8 },
    analyzeBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 14 },
    analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    loadingSection: { alignItems: 'center', paddingVertical: 60, gap: 16 },
    loadingText: { fontSize: 16, fontWeight: '600' },
    loadingHint: { fontSize: 13 },

    errorSection: { alignItems: 'center', paddingVertical: 40, gap: 16 },
    errorText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
    retryBtn: { borderWidth: 1.5, borderRadius: 99, paddingHorizontal: 24, paddingVertical: 10 },
    retryBtnText: { fontSize: 15, fontWeight: '600' },

    emptySection: { alignItems: 'center', paddingVertical: 40, gap: 16 },

    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    resultTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
    reanalyzeText: { fontSize: 13, fontWeight: '600' },

    card: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, gap: 10 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },

    categoryLabel: { fontSize: 12, fontWeight: '700' },
    cardDate: { fontSize: 12 },
    hookText: { fontSize: 16, fontWeight: '700', lineHeight: 24 },
    previewText: { fontSize: 13, lineHeight: 20 },
    reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: 8, padding: 10 },
    reasonText: { fontSize: 12, flex: 1, lineHeight: 18, fontWeight: '500' },
    detailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingVertical: 10 },
    detailBtnText: { fontSize: 13, fontWeight: '600' },
  })
}
