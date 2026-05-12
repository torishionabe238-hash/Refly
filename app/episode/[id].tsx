import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Modal } from 'react-native'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../utils/supabase'
import { Ionicons } from '@expo/vector-icons'
import AuroraGradient from '../../components/AuroraGradient'
import ThinkingIndicator from '../../components/ThinkingIndicator'
import { useTheme, Theme } from '../../utils/theme'

const MASTRA_URL = process.env.EXPO_PUBLIC_MASTRA_URL ?? 'http://10.1.62.38:4111'

type Episode = {
  id: string
  date: string
  episode_text: string
  points: string[]
  diary_count: number
  created_at: string
}

type Diary = {
  id: string
  content: string
}

type Structure = {
  tsukamni: string
  hondai: string
  ochi: string
}

const parseEpisodeContent = (raw: string) => {
  const episodeMatch = raw.match(/\*\*エピソードトーク[：:]\*\*\s*([\s\S]*?)(?=\*\*話すときのポイント|$)/)
  const pointsMatch = raw.match(/\*\*話すときのポイント[：:]\*\*\s*([\s\S]*)$/)
  return {
    episodeText: episodeMatch ? episodeMatch[1].trim() : raw.trim(),
    points: pointsMatch
      ? pointsMatch[1].split('\n').map(l => l.replace(/^[・\-\*]\s*/, '').trim()).filter(l => l.length > 0)
      : [],
  }
}

export default function EpisodeDetail() {
  const theme = useTheme()
  const { accent, gradientEnd } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])

  const { id } = useLocalSearchParams<{ id: string }>()
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuVisible, setMenuVisible] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [structure, setStructure] = useState<Structure | null>(null)
  const [structurizing, setStructurizing] = useState(false)
  const [showStructure, setShowStructure] = useState(false)
  const router = useRouter()
  const navigation = useNavigation()

  useEffect(() => {
    fetchEpisode()
  }, [])

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 8, marginRight: 4 }}>
          <Text style={{ fontSize: 22, color: accent, fontWeight: '700', letterSpacing: 1 }}>⋮</Text>
        </TouchableOpacity>
      ),
    })
  }, [accent])

  const fetchEpisode = async () => {
    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    setLoading(false)
    if (error || !data) { router.back(); return }
    setEpisode(data)
  }

  const deleteEpisode = () => {
    setMenuVisible(false)
    Alert.alert('エピソードを削除', 'このエピソードを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          const { error } = await supabase.from('episodes').delete().eq('id', id)
          setDeleting(false)
          if (error) Alert.alert('エラー', '削除に失敗しました')
          else router.back()
        },
      },
    ])
  }

  const regenerate = async () => {
    if (!episode) return
    setRegenerating(true)
    try {
      const { data: diaries, error } = await supabase
        .from('diaries')
        .select('content')
        .eq('date', episode.date)
        .order('created_at', { ascending: false })

      if (error || !diaries || diaries.length === 0) {
        Alert.alert('エラー', 'この日の日記が見つかりませんでした')
        return
      }

      const combinedContent = diaries.length === 1
        ? diaries[0].content
        : diaries.map((d: Diary, i: number) => `【日記${i + 1}】\n${d.content}`).join('\n\n')

      const res = await fetch(`${MASTRA_URL}/api/agents/episodify-agent/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: combinedContent }],
          threadId: `episodify-${episode.date}-${Date.now()}`,
          resourceId: 'refly-user',
        }),
      })
      const json = await res.json()
      const rawText = json.text ?? json.content ?? json.output ?? ''
      if (!rawText) throw new Error('empty response')

      const parsed = parseEpisodeContent(rawText)
      const { error: updateError } = await supabase
        .from('episodes')
        .update({ episode_text: parsed.episodeText, points: parsed.points })
        .eq('id', id)

      if (updateError) throw updateError
      setEpisode(prev => prev ? { ...prev, episode_text: parsed.episodeText, points: parsed.points } : prev)
      Alert.alert('完了', 'エピソードを再生成しました！')
    } catch (_e) {
      Alert.alert('エラー', '再生成に失敗しました')
    } finally {
      setRegenerating(false)
    }
  }

  const structurize = async () => {
    if (!episode) return
    setStructurizing(true)
    try {
      const res = await fetch(`${MASTRA_URL}/api/agents/structurize-agent/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: episode.episode_text }],
          threadId: `structurize-${episode.id}-${Date.now()}`,
          resourceId: 'refly-user',
        }),
      })
      const json = await res.json()
      const raw: string = json.text ?? json.content ?? json.output ?? ''
      if (!raw) throw new Error('empty response')

      const tsukamni = raw.match(/\*\*つかみ[：:]\*\*\s*([\s\S]*?)(?=\*\*本題|$)/)?.[1]?.trim() ?? ''
      const hondai   = raw.match(/\*\*本題[：:]\*\*\s*([\s\S]*?)(?=\*\*オチ|$)/)?.[1]?.trim() ?? ''
      const ochi     = raw.match(/\*\*オチ[：:]\*\*\s*([\s\S]*)$/)?.[1]?.trim() ?? ''

      if (!tsukamni) throw new Error('parse failed')
      setStructure({ tsukamni, hondai, ochi })
      setShowStructure(true)
    } catch {
      Alert.alert('エラー', '構成の生成に失敗しました')
    } finally {
      setStructurizing(false)
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={accent} size="large" /></View>
  }

  if (!episode) return null

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.date}>{episode.date}</Text>

        <AuroraGradient colors={[accent, gradientEnd]} style={styles.episodeCardGradient}>
          <View style={styles.episodeCard}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="book-outline" size={13} color={accent} />
              <Text style={styles.sectionLabel}>エピソード</Text>
            </View>
            <Text style={styles.episodeText}>{episode.episode_text}</Text>
          </View>
        </AuroraGradient>

        {episode.points.length > 0 && (
          <View style={styles.pointsCard}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="bulb-outline" size={13} color={accent} />
              <Text style={styles.sectionLabel}>話すときのポイント</Text>
            </View>
            {episode.points.map((point, i) => (
              <View key={i} style={styles.pointRow}>
                <View style={styles.pointBadge}>
                  <Text style={styles.pointBadgeText}>{i + 1}</Text>
                </View>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        )}

        {structurizing ? (
          <ThinkingIndicator steps={[
            'エピソードを読んでいます...',
            'つかみを考えています...',
            '本題を整理しています...',
            'オチを磨いています...',
            'もう少しで完成です...',
          ]} />
        ) : (
          <TouchableOpacity style={styles.structureBtn} onPress={structurize}>
            <Ionicons name="git-branch-outline" size={18} color={accent} />
            <Text style={styles.structureBtnText}>話し方の構成を見る</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={showStructure} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowStructure(false)}>
        {structure && (
          <View style={[styles.structureModal, { backgroundColor: theme.card }]}>
            <View style={[styles.structureHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.structureTitle, { color: theme.text }]}>話し方の構成</Text>
              <TouchableOpacity onPress={() => setShowStructure(false)}>
                <Text style={[styles.structureDone, { color: accent }]}>閉じる</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.structureContent}>
              {([
                { key: 'tsukamni', label: 'つかみ', icon: 'flash-outline', desc: '最初の一言で興味を引く' },
                { key: 'hondai',   label: '本題',   icon: 'book-outline',  desc: '何が起きたかを順に話す' },
                { key: 'ochi',     label: 'オチ',   icon: 'star-outline',  desc: '笑い・共感で締める' },
              ] as const).map(({ key, label, icon, desc }) => (
                <View key={key} style={[styles.structureCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                  <View style={styles.structureCardHeader}>
                    <View style={[styles.structureIconWrap, { backgroundColor: theme.accentBg }]}>
                      <Ionicons name={icon} size={16} color={accent} />
                    </View>
                    <View>
                      <Text style={[styles.structureCardLabel, { color: accent }]}>{label}</Text>
                      <Text style={[styles.structureCardDesc, { color: theme.sub }]}>{desc}</Text>
                    </View>
                  </View>
                  <Text style={[styles.structureCardText, { color: theme.text }]}>{structure[key]}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </Modal>

      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={deleteEpisode}>
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                {deleting ? '削除中...' : '削除'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, gap: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg },
    date: { fontSize: 14, color: t.accent, fontWeight: '600' },

    episodeCardGradient: {
      borderRadius: 18, padding: 1.5,
    },
    episodeCard: {
      backgroundColor: t.accentBg, borderRadius: 17, padding: 18, gap: 10,
    },

    pointsCard: {
      backgroundColor: t.card,
      borderRadius: 18,
      padding: 18,
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
    },

    sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: t.accent,
      letterSpacing: 0.5,
    },
    episodeText: { fontSize: 16, color: t.text, lineHeight: 28 },
    pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    pointBadge: {
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: t.accent,
      alignItems: 'center', justifyContent: 'center',
      marginTop: 2, flexShrink: 0,
    },
    pointBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
    pointText: { fontSize: 15, color: t.text, lineHeight: 24, flex: 1 },

    structureBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 14, borderRadius: 16,
      borderWidth: 1.5, borderColor: t.accentBorder,
      backgroundColor: t.accentBg,
    },
    structureBtnText: { fontSize: 15, fontWeight: '600', color: t.accent },
    structureModal: { flex: 1 },
    structureHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5,
    },
    structureTitle: { fontSize: 17, fontWeight: '600' },
    structureDone: { fontSize: 16, fontWeight: '600' },
    structureContent: { padding: 16, gap: 14 },
    structureCard: {
      borderRadius: 16, padding: 16, gap: 12, borderWidth: 1,
    },
    structureCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    structureIconWrap: {
      width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    },
    structureCardLabel: { fontSize: 15, fontWeight: '700' },
    structureCardDesc: { fontSize: 11, marginTop: 1 },
    structureCardText: { fontSize: 15, lineHeight: 26 },
    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
    menuCard: {
      position: 'absolute', top: 96, right: 16,
      backgroundColor: t.card, borderRadius: 14, width: 160,
      overflow: 'hidden',
    },
    menuItem: { paddingHorizontal: 20, paddingVertical: 16 },
    menuItemText: { fontSize: 16, color: t.text },
    menuItemDanger: { color: '#E24B4A' },
  })
}
