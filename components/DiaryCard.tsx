import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { stripHtml } from '../app/diary/[id]'
import { useTheme } from '../utils/theme'

type Diary = {
  id: string
  content: string
  date: string
  created_at: string
  photos?: string[]
  tags?: string[]
}

type Props = {
  diary: Diary
  onPress: () => void
  index?: number
  showIndex?: boolean
  showDate?: boolean
}

const formatTime = (created_at: string) => {
  const d = new Date(created_at)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`
}


const formatWrittenDate = (created_at: string) => {
  const d = new Date(created_at)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）${hh}:${min} に記入`
}

export default function DiaryCard({ diary, onPress, index, showIndex, showDate }: Props) {
  const { accent, accentBg, card, text, sub, border, dark } = useTheme()
  const preview = stripHtml(diary.content)
  const hasMore = preview.length > 80
  const tags = diary.tags ?? []
  const writtenOnDifferentDay = diary.date !== diary.created_at.split('T')[0]

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: card },
        dark && { borderWidth: 0.5, borderColor: border },
      ]}
    >
      {/* メタ行 */}
      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: sub }]}>
          {showDate
            ? `${formatDate(diary.date)}  ${formatTime(diary.created_at)}`
            : writtenOnDifferentDay
              ? formatWrittenDate(diary.created_at)
              : formatTime(diary.created_at)
          }
        </Text>
        {showIndex && index !== undefined && (
          <Text style={[styles.indexLabel, { color: sub }]}>{index + 1}件目</Text>
        )}
      </View>

      {/* 本文 */}
      <Text style={[styles.content, { color: text }]} numberOfLines={3}>{preview}</Text>

      {/* 続きを読む */}
      {hasMore && (
        <Text style={[styles.more, { color: accent }]}>続きを読む</Text>
      )}

      {/* タグ */}
      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsRow}
          contentContainerStyle={{ gap: 6 }}
        >
          {tags.map((tag, i) => (
            <View key={i} style={[styles.tagChip, { backgroundColor: accentBg }]}>
              <Text style={[styles.tagText, { color: accent }]}>#{tag}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  meta: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  indexLabel: { fontSize: 11, fontWeight: '500' },
  content: { fontSize: 15, lineHeight: 25 },
  more: { fontSize: 12, marginTop: 8, textAlign: 'right', fontWeight: '500' },
  tagsRow: { marginTop: 8 },
  tagChip: {
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontSize: 10, fontWeight: '500' },
})
