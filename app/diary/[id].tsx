import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Image, Dimensions, Modal, Animated, PanResponder } from 'react-native'
import ThinkingIndicator from '../../components/ThinkingIndicator'
import { LinearGradient } from 'expo-linear-gradient'
import AuroraGradient from '../../components/AuroraGradient'
import { Ionicons } from '@expo/vector-icons'
import { Platform } from 'react-native'
const WebView = Platform.OS === 'web'
  ? ({ style }: any) => <View style={style} />
  : require('react-native-webview').default
const PagerView = Platform.OS === 'web'
  ? ({ children, style }: any) => <View style={[style, { overflow: 'scroll' }]}>{children}</View>
  : require('react-native-pager-view').default
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../utils/supabase'
import { useNavigation } from 'expo-router'
import { useTheme, Theme } from '../../utils/theme'

const MASTRA_URL = process.env.EXPO_PUBLIC_MASTRA_URL ?? 'http://10.1.62.38:4111'

type Diary = {
  id: string
  title: string
  content: string
  date: string
  created_at: string
  photos: string[]
  tags: string[]
}

type VocabWord = {
  word: string
  reading: string
  meaning: string
  example: string
}

type FeedbackResult = {
  specificity: number
  emotion: number
  speakability: number
  advice: string
}

type EpisodeContent = {
  episodeText: string
  points: string[]
}

const formatTime = (created_at: string) => {
  const date = new Date(created_at)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

const parseVocab = (text: string): VocabWord[] => {
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v: any) => v.word && v.reading && v.meaning && v.example)
  } catch (_e) { return [] }
}

const parseEpisodeContent = (raw: string): EpisodeContent => {
  const episodeMatch = raw.match(/\*\*エピソードトーク[：:]\*\*\s*([\s\S]*?)(?=\*\*話すときのポイント|$)/)
  const pointsMatch = raw.match(/\*\*話すときのポイント[：:]\*\*\s*([\s\S]*)$/)
  return {
    episodeText: episodeMatch ? episodeMatch[1].trim() : raw.trim(),
    points: pointsMatch
      ? pointsMatch[1].split('\n').map(l => l.replace(/^[・\-\*]\s*/, '').trim()).filter(l => l.length > 0)
      : [],
  }
}

const parseFeedback = (text: string): FeedbackResult | null => {
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed.specificity !== 'number') return null
    return parsed
  } catch (_e) { return null }
}

const SCREEN_W = Dimensions.get('window').width

const PhotoGrid = ({ photos, onPress }: { photos: string[]; onPress: (index: number) => void }) => {
  const count = photos.length
  const W = SCREEN_W - 48
  const R = 14
  const G = 3

  if (count === 1) {
    return (
      <TouchableOpacity onPress={() => onPress(0)} activeOpacity={0.88} style={{ marginTop: 16 }}>
        <Image source={{ uri: photos[0] }} style={{ width: W, height: Math.round(W * 0.68), borderRadius: R }} resizeMode="cover" />
      </TouchableOpacity>
    )
  }

  if (count === 2) {
    const w = Math.floor((W - G) / 2)
    const h = Math.round(w * 1.25)
    return (
      <View style={{ flexDirection: 'row', gap: G, marginTop: 16 }}>
        {photos.map((url, i) => (
          <TouchableOpacity key={i} onPress={() => onPress(i)} activeOpacity={0.88}>
            <Image
              source={{ uri: url }}
              style={{
                width: w, height: h,
                borderTopLeftRadius: i === 0 ? R : G,
                borderBottomLeftRadius: i === 0 ? R : G,
                borderTopRightRadius: i === 1 ? R : G,
                borderBottomRightRadius: i === 1 ? R : G,
              }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  if (count === 3) {
    const lW = Math.floor(W * 0.58)
    const rW = W - lW - G
    const lH = Math.round(lW * 1.28)
    const rH = Math.floor((lH - G) / 2)
    return (
      <View style={{ flexDirection: 'row', gap: G, marginTop: 16 }}>
        <TouchableOpacity onPress={() => onPress(0)} activeOpacity={0.88}>
          <Image source={{ uri: photos[0] }} style={{ width: lW, height: lH, borderTopLeftRadius: R, borderBottomLeftRadius: R, borderTopRightRadius: G, borderBottomRightRadius: G }} resizeMode="cover" />
        </TouchableOpacity>
        <View style={{ gap: G }}>
          {photos.slice(1).map((url, i) => (
            <TouchableOpacity key={i} onPress={() => onPress(i + 1)} activeOpacity={0.88}>
              <Image
                source={{ uri: url }}
                style={{
                  width: rW, height: rH,
                  borderTopLeftRadius: G, borderBottomLeftRadius: G,
                  borderTopRightRadius: i === 0 ? R : G,
                  borderBottomRightRadius: i === 1 ? R : G,
                }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  }

  // 4枚以上: 2×2 グリッド、5枚目以降は +N オーバーレイ
  const visible = photos.slice(0, 4)
  const extra = count - 4
  const cW = Math.floor((W - G) / 2)
  const cH = Math.round(cW * 0.74)

  return (
    <View style={{ gap: G, marginTop: 16 }}>
      {[0, 1].map(row => (
        <View key={row} style={{ flexDirection: 'row', gap: G }}>
          {[0, 1].map(col => {
            const idx = row * 2 + col
            if (idx >= visible.length) return <View key={col} style={{ width: cW, height: cH }} />
            const showOverlay = idx === 3 && extra > 0
            return (
              <TouchableOpacity key={col} onPress={() => onPress(idx)} activeOpacity={0.88}>
                <Image
                  source={{ uri: visible[idx] }}
                  style={{
                    width: cW, height: cH,
                    borderTopLeftRadius: row === 0 && col === 0 ? R : G,
                    borderTopRightRadius: row === 0 && col === 1 ? R : G,
                    borderBottomLeftRadius: row === 1 && col === 0 ? R : G,
                    borderBottomRightRadius: row === 1 && col === 1 ? R : G,
                  }}
                  resizeMode="cover"
                />
                {showOverlay && (
                  <View style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.52)',
                    borderBottomRightRadius: R, borderTopLeftRadius: G, borderTopRightRadius: G, borderBottomLeftRadius: G,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 }}>+{extra}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const buildHtml = (content: string, bg: string, textColor: string) =>
  `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;padding:0;background:${bg};font-size:17px;font-family:-apple-system,'Helvetica Neue',sans-serif;line-height:1.75;color:${textColor};word-break:break-word}
h1{font-size:24px;font-weight:700;margin:8px 0 4px}
h2{font-size:20px;font-weight:700;margin:6px 0 4px}
p{margin:0 0 6px}
ul,ol{padding-left:22px;margin:4px 0}
li{margin:2px 0}
</style></head><body>${content}</body></html>`

export const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

const ScoreBar = ({ label, score }: { label: string; score: number }) => {
  const { accent, text, sub, border } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ fontSize: 13, color: sub, width: 56, fontWeight: '500' }}>{label}</Text>
      <View style={{ flex: 1, height: 8, backgroundColor: border, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${(score / 5) * 100}%`, backgroundColor: accent, borderRadius: 4 }} />
      </View>
      <Text style={{ fontSize: 12, color: accent, fontWeight: '700', width: 28, textAlign: 'right' }}>{score}/5</Text>
    </View>
  )
}

export default function DiaryDetail() {
  const theme = useTheme()
  const { accent, accentBg, accentBorder, accentLight, gradientEnd, card, text, sub, border, inputBg, dark } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])

  const { id } = useLocalSearchParams<{ id: string }>()
  const [diary, setDiary] = useState<Diary | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxPage, setLightboxPage] = useState(0)
  const [menuVisible, setMenuVisible] = useState(false)
  const [bodyHeight, setBodyHeight] = useState(300)

  const [vocabWords, setVocabWords] = useState<VocabWord[]>([])
  const [vocabLoading, setVocabLoading] = useState(false)
  const [vocabFetched, setVocabFetched] = useState(false)
  const [savedVocabSet, setSavedVocabSet] = useState<Set<string>>(new Set())

  const [feedback, setFeedback] = useState<FeedbackResult | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackFetched, setFeedbackFetched] = useState(false)

  const [episode, setEpisode] = useState<EpisodeContent | null>(null)
  const [episodeLoading, setEpisodeLoading] = useState(false)
  const [episodeFetched, setEpisodeFetched] = useState(false)
  const [episodeSaved, setEpisodeSaved] = useState(false)
  const [episodeSaving, setEpisodeSaving] = useState(false)

  const router = useRouter()
  const navigation = useNavigation()

  const translateY = useRef(new Animated.Value(0)).current
  const bgOpacity = useRef(new Animated.Value(1)).current

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 12 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onPanResponderGrant: () => {
        translateY.stopAnimation()
        bgOpacity.stopAnimation()
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          translateY.setValue(gs.dy)
          bgOpacity.setValue(Math.max(0.15, 1 - gs.dy / 260))
        }
      },
      onPanResponderRelease: (_, gs) => {
        const shouldDismiss = gs.dy > 110 || gs.vy > 1.2
        if (shouldDismiss) {
          Animated.parallel([
            Animated.timing(translateY, { toValue: Dimensions.get('window').height, duration: 220, useNativeDriver: true }),
            Animated.timing(bgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => {
            setLightboxIndex(null)
            translateY.setValue(0)
            bgOpacity.setValue(1)
          })
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, tension: 120, friction: 10, useNativeDriver: true }),
            Animated.spring(bgOpacity, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
          ]).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
          Animated.spring(bgOpacity, { toValue: 1, useNativeDriver: true }),
        ]).start()
      },
    })
  ).current

  useEffect(() => {
    if (lightboxIndex !== null) {
      translateY.setValue(0)
      bgOpacity.setValue(1)
    }
  }, [lightboxIndex])

  useEffect(() => { fetchDiary() }, [])

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 8, marginRight: 4 }}>
          <Text style={{ fontSize: 22, color: accent, fontWeight: '700', letterSpacing: 1 }}>⋮</Text>
        </TouchableOpacity>
      )
    })
  }, [id, accent])

  const fetchDiary = async () => {
    const [{ data, error }, { data: diaryTagsData }, { data: tagsData }] = await Promise.all([
      supabase.from('diaries').select('*').eq('id', id).maybeSingle(),
      supabase.from('diary_tags').select('tag_id').eq('diary_id', id),
      supabase.from('tags').select('id, name'),
    ])
    setLoading(false)
    if (error) { console.error(error); return }
    if (!data) { router.back(); return }
    const tagMap: Record<string, string> = {}
    ;(tagsData ?? []).forEach((t: any) => { tagMap[t.id] = t.name })
    const relationalTags = (diaryTagsData ?? []).map((dt: any) => tagMap[dt.tag_id]).filter(Boolean)
    const tags = relationalTags.length > 0 ? relationalTags : (Array.isArray(data.tags) ? data.tags : [])
    setDiary({ ...data, tags })
    fetchSavedWords()
  }

  const fetchSavedWords = async () => {
    try {
      const { data } = await supabase.from('saved_words').select('word').eq('diary_id', id)
      if (data) setSavedVocabSet(new Set(data.map(r => r.word)))
    } catch (_e) {}
  }

  const fetchVocab = async (content: string, previousWords?: string[]) => {
    setVocabLoading(true); setVocabFetched(true)
    try {
      const prev = previousWords && previousWords.length > 0
        ? `\n\n【前回の提案（これらとは異なる言葉を提案してください）】\n${previousWords.join('、')}`
        : ''
      const res = await fetch(`${MASTRA_URL}/api/agents/vocab-agent/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: content + prev }], threadId: `vocab-${id}-${Date.now()}`, resourceId: 'refly-user' }),
      })
      const data = await res.json()
      setVocabWords(parseVocab(data.text ?? data.content ?? data.output ?? ''))
    } catch (_e) {
      Alert.alert('エラー', '語彙の取得に失敗しました')
    } finally { setVocabLoading(false) }
  }

  const fetchEpisode = async () => {
    if (!diary) return
    setEpisodeLoading(true); setEpisodeFetched(true); setEpisodeSaved(false)
    try {
      const { data: diaries } = await supabase
        .from('diaries').select('content').eq('date', diary.date).order('created_at', { ascending: true })
      if (!diaries || diaries.length === 0) return
      const content = diaries.length === 1
        ? stripHtml(diaries[0].content)
        : diaries.map((d, i) => `【日記${i + 1}】\n${stripHtml(d.content)}`).join('\n\n')
      const res = await fetch(`${MASTRA_URL}/api/agents/episodify-agent/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content }], threadId: `episodify-${diary.date}-${Date.now()}`, resourceId: 'refly-user' }),
      })
      const data = await res.json()
      const raw = data.text ?? data.content ?? data.output ?? data.result ?? ''
      setEpisode(parseEpisodeContent(raw))
    } catch (_e) {
      Alert.alert('エラー', 'エピソード化に失敗しました')
    } finally {
      setEpisodeLoading(false)
    }
  }

  const saveEpisode = async () => {
    if (!episode || !diary) return
    setEpisodeSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: allDiaries } = await supabase
        .from('diaries').select('id').eq('date', diary.date)
      const { error } = await supabase.from('episodes').insert({
        user_id: session.user.id, date: diary.date,
        episode_text: episode.episodeText, points: episode.points,
        diary_count: allDiaries?.length ?? 1,
      })
      if (error) throw error
      setEpisodeSaved(true)
    } catch (_e) {
      Alert.alert('エラー', '保存に失敗しました')
    } finally {
      setEpisodeSaving(false)
    }
  }

  const fetchFeedback = async (content: string) => {
    setFeedbackLoading(true); setFeedbackFetched(true)
    try {
      const res = await fetch(`${MASTRA_URL}/api/agents/feedback-agent/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content }], threadId: `feedback-${id}`, resourceId: 'refly-user' }),
      })
      const data = await res.json()
      setFeedback(parseFeedback(data.text ?? data.content ?? data.output ?? ''))
    } catch (_e) {
      Alert.alert('エラー', 'フィードバックの取得に失敗しました')
    } finally { setFeedbackLoading(false) }
  }

  const saveWord = async (word: VocabWord) => {
    if (savedVocabSet.has(word.word)) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await supabase.from('saved_words').insert({
        user_id: session.user.id, diary_id: id,
        word: word.word, reading: word.reading,
        meaning: word.meaning, example: word.example,
      })
      setSavedVocabSet(prev => new Set([...prev, word.word]))
    } catch (_e) {}
  }

  const deleteDiary = () => {
    setMenuVisible(false)
    Alert.alert('日記を削除', 'この日記を削除しますか？この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          const { error } = await supabase.from('diaries').delete().eq('id', id)
          setDeleting(false)
          if (error) Alert.alert('エラー', '削除に失敗しました')
          else router.back()
        }
      }
    ])
  }


  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} size="large" /></View>
  if (!diary) return <View style={styles.center}><Text style={styles.emptyText}>日記が見つかりませんでした</Text></View>

  return (
    <View style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.dateRow}>
          <Text style={styles.date}>
            {diary.date !== diary.created_at.split('T')[0]
              ? diary.date
              : `${diary.date}　${formatTime(diary.created_at)}`}
          </Text>
          {diary.tags?.length > 0 && (
            <View style={styles.tagsRow}>
              {diary.tags.map((tag, i) => (
                <View key={i} style={[styles.tagChip, { backgroundColor: accentBg }]}>
                  <Text style={[styles.tagText, { color: accent }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 日記本文 */}
        {Platform.OS === 'web' ? (
          <Text style={{ fontSize: 17, lineHeight: 30, color: text, paddingHorizontal: 16, paddingVertical: 8, textAlign: 'left' }}>
            {stripHtml(diary.content)}
          </Text>
        ) : (
          <WebView
            key={card}
            source={{ html: buildHtml(diary.content, card, text) }}
            style={{ height: bodyHeight, backgroundColor: card }}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            onMessage={e => setBodyHeight(Number(e.nativeEvent.data) + 8)}
            injectedJavaScript="setTimeout(()=>window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight)),120);true;"
          />
        )}

        {diary.photos?.length > 0 && (
          <PhotoGrid
            photos={diary.photos}
            onPress={i => { setLightboxIndex(i); setLightboxPage(i) }}
          />
        )}

        {/* 書き方フィードバック */}
        <View style={styles.aiSection}>
          <View style={styles.aiSectionHeader}>
            <View style={styles.aiSectionLeft}>
              <View style={styles.aiTitleRow}>
                <Ionicons name="bar-chart-outline" size={16} color={accent} />
                <Text style={styles.aiSectionTitle}>書き方診断</Text>
                <LinearGradient colors={[accent, gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>AI</Text>
                </LinearGradient>
              </View>
              <Text style={styles.aiSectionSub}>話しやすさをAIが採点します</Text>
            </View>
            {!feedbackFetched && (
              <AuroraGradient colors={[accent, gradientEnd]} style={styles.aiButtonGrad}>
                <TouchableOpacity style={styles.aiButton} onPress={() => fetchFeedback(diary.content)}>
                  <Ionicons name="bar-chart-outline" size={13} color="#fff" />
                  <Text style={styles.aiButtonText}>診断する</Text>
                </TouchableOpacity>
              </AuroraGradient>
            )}
          </View>
          {feedbackLoading && (
            <ThinkingIndicator steps={[
              '日記を読んでいます...',
              '具体性を分析しています...',
              '感情表現を確認しています...',
              '話しやすさを採点しています...',
              'アドバイスを考えています...',
            ]} />
          )}
          {!feedbackLoading && feedbackFetched && !feedback && (
            <Text style={styles.aiEmpty}>診断を取得できませんでした</Text>
          )}
          {feedback && (
            <View style={styles.feedbackBody}>
              <ScoreBar label="具体性" score={feedback.specificity} />
              <ScoreBar label="感情表現" score={feedback.emotion} />
              <ScoreBar label="話しやすさ" score={feedback.speakability} />
              <View style={styles.adviceBox}>
                <Text style={styles.adviceLabel}>アドバイス</Text>
                <Text style={styles.adviceText}>{feedback.advice}</Text>
              </View>
              <TouchableOpacity style={styles.retryBtn} onPress={() => { setFeedback(null); fetchFeedback(diary.content) }}>
                <Text style={styles.retryBtnText}>再診断</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 語彙提案 */}
        <View style={styles.aiSection}>
          <View style={styles.aiSectionHeader}>
            <View style={styles.aiSectionLeft}>
              <View style={styles.aiTitleRow}>
                <Ionicons name="bulb-outline" size={16} color={accent} />
                <Text style={styles.aiSectionTitle}>言葉のヒント</Text>
                <LinearGradient colors={[accent, gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>AI</Text>
                </LinearGradient>
              </View>
              <Text style={styles.aiSectionSub}>会話でスマートに見える表現を提案</Text>
            </View>
            {!vocabFetched && (
              <AuroraGradient colors={[accent, gradientEnd]} style={styles.aiButtonGrad}>
                <TouchableOpacity style={styles.aiButton} onPress={() => fetchVocab(diary.content)}>
                  <Ionicons name="bulb-outline" size={13} color="#fff" />
                  <Text style={styles.aiButtonText}>提案を見る</Text>
                </TouchableOpacity>
              </AuroraGradient>
            )}
          </View>
          {vocabLoading && (
            <ThinkingIndicator steps={[
              '日記を読んでいます...',
              '使われている言葉を整理しています...',
              '言い換え表現を探しています...',
              '会話で使える言葉を選んでいます...',
            ]} />
          )}
          {!vocabLoading && vocabFetched && vocabWords.length === 0 && (
            <Text style={styles.aiEmpty}>提案を取得できませんでした</Text>
          )}
          {vocabWords.length > 0 && (
            <View style={styles.vocabList}>
              {vocabWords.map((v, i) => (
                <View key={i} style={styles.vocabCard}>
                  <View style={styles.vocabCardTop}>
                    <View style={styles.vocabWordRow}>
                      <Text style={styles.vocabWord}>{v.word}</Text>
                      <Text style={styles.vocabReading}>（{v.reading}）</Text>
                    </View>
                    <Text style={styles.vocabMeaning}>{v.meaning}</Text>
                    <TouchableOpacity
                      style={[styles.saveWordBtn, savedVocabSet.has(v.word) && styles.saveWordBtnSaved]}
                      onPress={() => saveWord(v)}
                      disabled={savedVocabSet.has(v.word)}
                    >
                      <Text style={[styles.saveWordBtnText, savedVocabSet.has(v.word) && styles.saveWordBtnTextSaved]}>
                        {savedVocabSet.has(v.word) ? '保存済み ✓' : '単語帳に保存'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.vocabExampleBox}>
                    <Text style={styles.vocabExampleLabel}>使い方</Text>
                    <Text style={styles.vocabExample}>「{v.example}」</Text>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.retryBtn} onPress={() => { const prev = vocabWords.map(v => v.word); setVocabWords([]); setVocabFetched(false); fetchVocab(diary.content, prev) }}>
                <Text style={styles.retryBtnText}>再生成</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* エピソード化 */}
        <View style={styles.aiSection}>
          <View style={styles.aiSectionHeader}>
            <View style={styles.aiSectionLeft}>
              <View style={styles.aiTitleRow}>
                <Ionicons name="chatbubbles-outline" size={16} color={accent} />
                <Text style={styles.aiSectionTitle}>エピソードトーク</Text>
                <LinearGradient colors={[accent, gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>AI</Text>
                </LinearGradient>
              </View>
              <Text style={styles.aiSectionSub}>この日記をエピソード化</Text>
            </View>
            {!episodeFetched && (
              <AuroraGradient colors={[accent, gradientEnd]} style={styles.aiButtonGrad}>
                <TouchableOpacity style={styles.aiButton} onPress={fetchEpisode}>
                  <Ionicons name="chatbubbles-outline" size={13} color="#fff" />
                  <Text style={styles.aiButtonText}>エピソード化</Text>
                </TouchableOpacity>
              </AuroraGradient>
            )}
          </View>
          {episodeLoading && (
            <ThinkingIndicator steps={[
              '日記を読んでいます...',
              'エピソードの山場を探しています...',
              'フリとオチを設計しています...',
              '話し言葉に仕上げています...',
              'もう少しで完成です...',
            ]} />
          )}
          {!episodeLoading && episodeFetched && !episode && (
            <Text style={styles.aiEmpty}>エピソードを取得できませんでした</Text>
          )}
          {episode && (
            <View style={styles.episodeBody}>
              <View style={styles.episodeTextCard}>
                <Text style={styles.episodeText}>{episode.episodeText}</Text>
              </View>
              {episode.points.length > 0 && (
                <View style={styles.pointsCard}>
                  <Text style={styles.pointsTitle}>話すときのポイント</Text>
                  {episode.points.map((point, i) => (
                    <View key={i} style={styles.pointRow}>
                      <View style={styles.pointBadge}><Text style={styles.pointBadgeText}>{i + 1}</Text></View>
                      <Text style={styles.pointText}>{point}</Text>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity
                style={[styles.episodeSaveBtn, episodeSaved && styles.episodeSaveBtnDone]}
                onPress={saveEpisode}
                disabled={episodeSaving || episodeSaved}
              >
                <Text style={styles.episodeSaveBtnText}>
                  {episodeSaved ? '保存済み ✓' : episodeSaving ? '保存中...' : 'エピソードを保存'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retryBtn} onPress={() => { setEpisode(null); setEpisodeFetched(false); fetchEpisode() }}>
                <Text style={styles.retryBtnText}>再生成</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push(`/diary/edit?id=${id}`) }}>
              <Text style={styles.menuItemText}>編集</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={deleteDiary}>
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>{deleting ? '削除中...' : '削除'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={lightboxIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxIndex(null)}
        statusBarTranslucent
      >
        {/* 背景: ドラッグに連動して薄くなる */}
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#000', opacity: bgOpacity }} />

        {/* コンテンツ: 縦にスワイプで動く */}
        <Animated.View
          style={{ flex: 1, transform: [{ translateY }] }}
          {...panResponder.panHandlers}
        >
          {/* カウンター */}
          {diary.photos && diary.photos.length > 1 && (
            <View style={{ position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center', zIndex: 10 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 5 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>
                  {lightboxPage + 1} / {diary.photos.length}
                </Text>
              </View>
            </View>
          )}
          {/* 閉じるボタン */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 56, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 99, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setLightboxIndex(null)}
          >
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
          {/* スワイプビューワー */}
          {diary.photos && diary.photos.length > 0 && (
            <PagerView
              style={{ flex: 1 }}
              initialPage={lightboxIndex ?? 0}
              onPageSelected={e => setLightboxPage(e.nativeEvent.position)}
            >
              {diary.photos.map((url, i) => (
                <View key={i} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Image
                    source={{ uri: url }}
                    style={{ width: SCREEN_W, height: SCREEN_W * 1.2 }}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </PagerView>
          )}
          {/* ドットインジケーター */}
          {diary.photos && diary.photos.length > 1 && (
            <View style={{ position: 'absolute', bottom: 48, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              {diary.photos.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === lightboxPage ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === lightboxPage ? '#fff' : 'rgba(255,255,255,0.35)',
                  }}
                />
              ))}
            </View>
          )}
          {/* スワイプダウンヒント（最初だけ薄く表示） */}
          <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          </View>
        </Animated.View>
      </Modal>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.card },
    content: { padding: 24 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.card },
    emptyText: { fontSize: 16, color: t.sub },
    dateRow: { marginBottom: 16, gap: 8 },
    date: { fontSize: 14, color: t.accent, fontWeight: '500' },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tagChip: { borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 },
    tagText: { fontSize: 10, fontWeight: '500' },

    aiSection: { marginTop: 28, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 20 },
    aiSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    aiSectionLeft: { flex: 1, marginRight: 10 },
    aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    aiSectionTitle: { fontSize: 15, fontWeight: '700', color: t.text },
    aiSectionSub: { fontSize: 12, color: t.sub, marginTop: 4 },
    aiBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    aiBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
    aiButtonGrad: { borderRadius: 12, overflow: 'hidden' },
    aiButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 9 },
    aiButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    aiLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
    aiLoadingText: { fontSize: 13, color: t.sub },
    aiEmpty: { fontSize: 14, color: t.sub, paddingVertical: 8 },
    retryBtn: { alignItems: 'center', paddingVertical: 10 },
    retryBtnText: { fontSize: 13, color: t.accent, fontWeight: '600' },

    feedbackBody: { gap: 10 },
    adviceBox: { backgroundColor: t.accentBg, borderRadius: 12, padding: 14, gap: 4, marginTop: 4 },
    adviceLabel: { fontSize: 10, color: t.accent, fontWeight: '700', letterSpacing: 0.5 },
    adviceText: { fontSize: 14, color: t.text, lineHeight: 22 },

    episodeBody: { gap: 12 },
    episodeTextCard: { backgroundColor: t.accentBg, borderRadius: 14, padding: 16, borderLeftWidth: 3, borderLeftColor: t.accent },
    episodeText: { fontSize: 15, color: t.text, lineHeight: 26 },
    pointsCard: { backgroundColor: t.inputBg, borderRadius: 14, padding: 16, gap: 10 },
    pointsTitle: { fontSize: 12, fontWeight: '700', color: t.accent, letterSpacing: 0.5 },
    pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    pointBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 as const },
    pointBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
    pointText: { fontSize: 14, color: t.text, lineHeight: 22, flex: 1 },
    episodeSaveBtn: { backgroundColor: t.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' as const },
    episodeSaveBtnDone: { backgroundColor: t.accentLight },
    episodeSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    vocabList: { gap: 10 },
    vocabCard: { backgroundColor: t.accentBg, borderRadius: 14, borderWidth: 1, borderColor: t.accentBorder, overflow: 'hidden' },
    vocabCardTop: { padding: 14, gap: 6 },
    vocabWordRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    vocabWord: { fontSize: 18, fontWeight: '700', color: t.text },
    vocabReading: { fontSize: 12, color: t.sub },
    vocabMeaning: { fontSize: 13, color: t.text },
    saveWordBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: t.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
    saveWordBtnSaved: { backgroundColor: t.accentBg, borderColor: t.accentBorder },
    saveWordBtnText: { fontSize: 12, color: t.accent, fontWeight: '600' },
    saveWordBtnTextSaved: { color: t.accentLight },
    vocabExampleBox: { backgroundColor: t.inputBg, paddingHorizontal: 14, paddingVertical: 10, gap: 3 },
    vocabExampleLabel: { fontSize: 10, color: t.accent, fontWeight: '700', letterSpacing: 0.5 },
    vocabExample: { fontSize: 13, color: t.text, lineHeight: 20 },

    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
    menuCard: { position: 'absolute', top: 96, right: 16, backgroundColor: t.card, borderRadius: 14, width: 160, overflow: 'hidden' },
    menuItem: { paddingHorizontal: 20, paddingVertical: 16 },
    menuItemText: { fontSize: 16, color: t.text },
    menuItemDanger: { color: '#E24B4A' },
    menuDivider: { height: 0.5, backgroundColor: t.border, marginHorizontal: 12 },
  })
}
