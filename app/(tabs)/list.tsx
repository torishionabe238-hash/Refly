import { View, Text, StyleSheet, SectionList, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image, TextInput, Modal, Dimensions, PanResponder, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import DiaryCard from '../../components/DiaryCard'
import { Ionicons } from '@expo/vector-icons'
import { stripHtml } from '../diary/[id]'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { supabase } from '../../utils/supabase'
import { getTagOrder, applyTagOrder } from '../../utils/tags'
import { Platform } from 'react-native'
const PagerView = Platform.OS === 'web'
  ? ({ children, style }: any) => <View style={style}>{children}</View>
  : require('react-native-pager-view').default
import { Calendar } from 'react-native-calendars'
import { useTheme, Theme } from '../../utils/theme'

type Diary = {
  id: string
  content: string
  date: string
  created_at: string
  photos: string[]
  tags: string[]
}


type SortOrder = 'date_desc' | 'date_asc' | 'created_desc' | 'created_asc'

const SORT_LABELS: Record<SortOrder, string> = {
  date_desc: '日付：新しい順',
  date_asc:  '日付：古い順',
  created_desc: '投稿：新しい順',
  created_asc:  '投稿：古い順',
}

const formatTime = (created_at: string) => {
  const d = new Date(created_at)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const formatSectionDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`
}

const formatBookDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']
  return { year: d.getFullYear(), monthDay: `${d.getMonth() + 1}月${d.getDate()}日`, dayOfWeek: days[d.getDay()] }
}


export default function ListScreen() {
  const theme = useTheme()
  const { accent, accentBg, accentBorder, accentLight, gradientEnd, bg, card, text, sub, border, inputBg } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'book'>('list')
  const [sortOrder, setSortOrder] = useState<SortOrder>('date_desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortPickerVisible, setSortPickerVisible] = useState(false)
  const [jumpPickerVisible, setJumpPickerVisible] = useState(false)
  const [diaries, setDiaries] = useState<Diary[]>([])
  const [orderedTagNames, setOrderedTagNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const sectionListRef = useRef<SectionList>(null)
  const flatListRef = useRef<FlatList>(null)
  const bookPagerRef = useRef<PagerView>(null)
  const tagChipScrollRef = useRef<ScrollView>(null)
  const hasLoadedOnce = useRef(false)
  const router = useRouter()

  useFocusEffect(useCallback(() => {
    if (!hasLoadedOnce.current) {
      setLoading(true)
    }
    fetchAll()
  }, []))

  const fetchAll = async () => {
    const [diaryRes, diaryTagsRes, tagsRes, order] = await Promise.all([
      supabase.from('diaries').select('*'),
      supabase.from('diary_tags').select('diary_id, tag_id'),
      supabase.from('tags').select('id, name'),
      getTagOrder(),
    ])
    const orderedTags = applyTagOrder(tagsRes.data ?? [], order)
    setOrderedTagNames(orderedTags.map((t: any) => t.name))
    const tagMap: Record<string, string> = {}
    ;(tagsRes.data ?? []).forEach((t: any) => { tagMap[t.id] = t.name })
    const diaryTagMap: Record<string, string[]> = {}
    ;(diaryTagsRes.data ?? []).forEach((dt: any) => {
      if (!diaryTagMap[dt.diary_id]) diaryTagMap[dt.diary_id] = []
      if (tagMap[dt.tag_id]) diaryTagMap[dt.diary_id].push(tagMap[dt.tag_id])
    })
    const diaries = (diaryRes.data ?? []).map((d: any) => ({
      ...d,
      tags: diaryTagMap[d.id] ?? (Array.isArray(d.tags) ? d.tags : []),
    }))
    setDiaries(diaries)
    setLoading(false)
    setRefreshing(false)
    hasLoadedOnce.current = true
  }

  const onRefresh = () => { setRefreshing(true); fetchAll() }

  const allTags = useMemo(() => {
    const used = new Set<string>()
    diaries.forEach(d => (d.tags ?? []).forEach(t => used.add(t)))
    const ordered = orderedTagNames.filter(name => used.has(name))
    const rest = Array.from(used).filter(name => !orderedTagNames.includes(name)).sort()
    return [...ordered, ...rest]
  }, [diaries, orderedTagNames])

  const tagPages = useMemo(() => [null, ...allTags] as (string | null)[], [allTags])
  const tagPagesRef = useRef(tagPages)
  tagPagesRef.current = tagPages

  const currentTagIndex = useMemo(() => {
    const idx = tagPages.indexOf(filterTag)
    return idx >= 0 ? idx : 0
  }, [filterTag, tagPages])
  const currentTagIndexRef = useRef(currentTagIndex)
  currentTagIndexRef.current = currentTagIndex

  const slideAnim = useRef(new Animated.Value(0)).current
  const isAnimating = useRef(false)
  const SCREEN_WIDTH = Dimensions.get('window').width

  const slideToTag = useCallback((direction: 1 | -1) => {
    if (isAnimating.current) return
    const pages = tagPagesRef.current
    const nextIndex = currentTagIndexRef.current + direction
    if (nextIndex < 0 || nextIndex >= pages.length) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 180, friction: 20 }).start()
      return
    }
    isAnimating.current = true
    Animated.timing(slideAnim, {
      toValue: -direction * SCREEN_WIDTH,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(direction * SCREEN_WIDTH)
      setFilterTag(pages[nextIndex])
      tagChipScrollRef.current?.scrollTo({ x: Math.max(0, nextIndex * 90 - 40), animated: true })
      isAnimating.current = false
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 180,
        friction: 20,
      }).start()
    })
  }, [])

  const slideToTagRef = useRef(slideToTag)
  useEffect(() => { slideToTagRef.current = slideToTag }, [slideToTag])

  const goToTagIndex = useCallback((targetIndex: number) => {
    const pages = tagPagesRef.current
    const current = currentTagIndexRef.current
    if (targetIndex === current || isAnimating.current) return
    const direction = targetIndex > current ? 1 : -1
    isAnimating.current = true
    Animated.timing(slideAnim, {
      toValue: -direction * SCREEN_WIDTH,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(direction * SCREEN_WIDTH)
      setFilterTag(pages[targetIndex])
      tagChipScrollRef.current?.scrollTo({ x: Math.max(0, targetIndex * 90 - 40), animated: true })
      isAnimating.current = false
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 180, friction: 20 }).start()
    })
  }, [])

  const swipePanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 6 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.2,
    onPanResponderMove: (_, gs) => {
      if (!isAnimating.current) slideAnim.setValue(gs.dx * 0.6)
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx < -20 || gs.vx < -0.2) slideToTagRef.current(1)
      else if (gs.dx > 20 || gs.vx > 0.2) slideToTagRef.current(-1)
      else Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 180, friction: 20 }).start()
    },
  })).current

  const sortedDiaries = useMemo(() => {
    let result = diaries
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(d => d.content.toLowerCase().includes(q))
    }
    if (filterTag) {
      result = result.filter(d => (d.tags ?? []).includes(filterTag))
    }
    return [...result].sort((a, b) => {
      switch (sortOrder) {
        case 'date_desc':    return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
        case 'date_asc':     return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)
        case 'created_desc': return b.created_at.localeCompare(a.created_at)
        case 'created_asc':  return a.created_at.localeCompare(b.created_at)
      }
    })
  }, [diaries, sortOrder, searchQuery, filterTag])

  const bookSections = useMemo(() => {
    let result = diaries
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(d => d.content.toLowerCase().includes(q))
    }
    if (filterTag) {
      result = result.filter(d => (d.tags ?? []).includes(filterTag))
    }
    const grouped: Record<string, Diary[]> = {}
    result.forEach(d => {
      if (!grouped[d.date]) grouped[d.date] = []
      grouped[d.date].push(d)
    })
    Object.values(grouped).forEach(entries =>
      entries.sort((a, b) => a.created_at.localeCompare(b.created_at))
    )
    return Object.entries(grouped)
      .sort(([a], [b]) => sortOrder === 'date_asc' ? b.localeCompare(a) : a.localeCompare(b))
      .map(([date, data]) => ({ title: date, data }))
  }, [diaries, searchQuery, sortOrder, filterTag])

  const diaryDates = useMemo(() => {
    const marks: Record<string, any> = {}
    diaries.forEach(d => { marks[d.date] = { marked: true, dotColor: accent } })
    return marks
  }, [diaries, accent])

  const handleJumpToDate = (dateStr: string) => {
    setJumpPickerVisible(false)
    if (viewMode === 'book') {
      const idx = bookSections.findIndex(s => s.title === dateStr)
      if (idx >= 0) bookPagerRef.current?.setPage(idx)
      return
    }
    if (sortOrder === 'created_desc' || sortOrder === 'created_asc') {
      const idx = sortedDiaries.findIndex(d => d.date === dateStr)
      if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true })
      return
    }
    const sIdx = diarySections.findIndex(s => s.title === dateStr)
    if (sIdx >= 0) {
      sectionListRef.current?.scrollToLocation({ sectionIndex: sIdx, itemIndex: 0, animated: true, viewOffset: 0 })
    }
  }

  const diarySections = useMemo(() => {
    const grouped: Record<string, Diary[]> = {}
    sortedDiaries.forEach(d => {
      if (!grouped[d.date]) grouped[d.date] = []
      grouped[d.date].push(d)
    })
    return Object.entries(grouped)
      .sort(([dateA, entriesA], [dateB, entriesB]) => {
        if (sortOrder === 'created_desc' || sortOrder === 'created_asc') {
          const latestA = entriesA.reduce((m, e) => e.created_at > m ? e.created_at : m, '')
          const latestB = entriesB.reduce((m, e) => e.created_at > m ? e.created_at : m, '')
          return sortOrder === 'created_desc' ? latestB.localeCompare(latestA) : latestA.localeCompare(latestB)
        }
        return sortOrder === 'date_asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
      })
      .map(([date, data]) => ({ title: date, data }))
  }, [sortedDiaries, sortOrder])

  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} size="large" /></View>

  return (
    <View style={styles.container}>
      {/* 並び替えピッカー */}
      <Modal visible={sortPickerVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setSortPickerVisible(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>並び替え</Text>
            {(viewMode === 'book' ? ['date_desc', 'date_asc'] as SortOrder[] : Object.keys(SORT_LABELS) as SortOrder[]).map(key => (
              <TouchableOpacity
                key={key}
                style={[styles.pickerItem, sortOrder === key && styles.pickerItemActive]}
                onPress={() => { setSortOrder(key); setSortPickerVisible(false) }}
              >
                <Text style={[styles.pickerItemText, sortOrder === key && styles.pickerItemTextActive]}>
                  {SORT_LABELS[key]}
                </Text>
                {sortOrder === key && <Ionicons name="checkmark" size={18} color={accent} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 0.5, backgroundColor: border, marginHorizontal: 20, marginVertical: 4 }} />
            <TouchableOpacity
              style={styles.pickerItem}
              onPress={() => { setSortPickerVisible(false); setJumpPickerVisible(true) }}
            >
              <Text style={styles.pickerItemText}>日付にジャンプ</Text>
              <Ionicons name="calendar-outline" size={18} color={sub} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 日付ジャンプピッカー */}
      <Modal visible={jumpPickerVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setJumpPickerVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.jumpPickerCard}>
            <View style={styles.jumpPickerHeader}>
              <Text style={[styles.pickerTitle, { paddingHorizontal: 0, paddingVertical: 0 }]}>日付にジャンプ</Text>
              <TouchableOpacity onPress={() => setJumpPickerVisible(false)}>
                <Ionicons name="close" size={20} color={sub} />
              </TouchableOpacity>
            </View>
            <Calendar
              markedDates={diaryDates}
              onDayPress={day => handleJumpToDate(day.dateString)}
              theme={{ todayTextColor: accent, arrowColor: accent, calendarBackground: card, dayTextColor: text, textSectionTitleColor: sub, textDisabledColor: sub }}
            />
            <View style={{ height: 8 }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={{ flex: 1, overflow: 'hidden' }} {...(viewMode === 'list' ? swipePanResponder.panHandlers : {})}>
          <View style={styles.toolbar}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={15} color={sub} />
              <TextInput
                style={styles.searchInput}
                placeholder="日記を検索..."
                placeholderTextColor={sub}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={sub} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.sortButton} onPress={() => setSortPickerVisible(true)}>
              <Ionicons name="options-outline" size={18} color={accent} />
            </TouchableOpacity>
            <View style={styles.viewToggle}>
              <TouchableOpacity style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]} onPress={() => setViewMode('list')}>
                <Ionicons name="list-outline" size={18} color={viewMode === 'list' ? accent : sub} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, viewMode === 'book' && styles.toggleBtnActive]} onPress={() => { setViewMode('book'); if (sortOrder === 'created_desc' || sortOrder === 'created_asc') setSortOrder('date_desc') }}>
                <Ionicons name="book-outline" size={18} color={viewMode === 'book' ? accent : sub} />
              </TouchableOpacity>
            </View>
          </View>
          {allTags.length > 0 && (
            <View style={styles.tagFilterBar}>
              <ScrollView
                ref={tagChipScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' }}
              >
                <TouchableOpacity
                  style={[styles.tagFilterChip, !filterTag && styles.tagFilterChipActive]}
                  onPress={() => goToTagIndex(0)}
                >
                  <Text style={[styles.tagFilterText, !filterTag && styles.tagFilterTextActive]}>すべて</Text>
                </TouchableOpacity>
                {allTags.map((tag, i) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagFilterChip, filterTag === tag && styles.tagFilterChipActive]}
                    onPress={() => goToTagIndex(i + 1)}
                  >
                    <Text style={[styles.tagFilterText, filterTag === tag && styles.tagFilterTextActive]}>#{tag}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
          {(viewMode === 'book' ? bookSections : diarySections).length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {filterTag ? `#${filterTag} の日記がありません` : searchQuery ? '一致する日記がありません' : 'まだ日記がありません'}
              </Text>
              {filterTag ? (
                <TouchableOpacity onPress={() => setFilterTag(null)} style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.accentBg, borderRadius: 99 }}>
                  <Text style={{ color: theme.accent, fontWeight: '600', fontSize: 13 }}>フィルターをクリア</Text>
                </TouchableOpacity>
              ) : !searchQuery ? (
                <Text style={styles.emptyHint}>ホームタブから書いてみよう！</Text>
              ) : null}
            </View>
          ) : viewMode === 'list' ? (
            sortOrder === 'created_desc' || sortOrder === 'created_asc' ? (
              <FlatList
                ref={flatListRef}
                data={sortedDiaries}
                keyExtractor={item => item.id}
                onScrollToIndexFailed={({ index }) => flatListRef.current?.scrollToEnd()}

                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />}
                renderItem={({ item }) => (
                  <DiaryCard diary={item} onPress={() => router.push(`/diary/${item.id}`)} showDate />
                )}
              />
            ) : (
              <SectionList
                ref={sectionListRef}
                sections={diarySections}
                keyExtractor={item => item.id}
                onScrollToIndexFailed={() => {}}

                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />}
                renderSectionHeader={({ section }) => (
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionDot} />
                    <Text style={styles.sectionTitle}>{formatSectionDate(section.title)}</Text>
                    <Text style={styles.sectionCount}>{section.data.length}件</Text>
                  </View>
                )}
                renderItem={({ item, index }) => (
                  <DiaryCard diary={item} onPress={() => router.push(`/diary/${item.id}`)} index={index} showIndex />
                )}
                SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                stickySectionHeadersEnabled={false}
              />
            )
          ) : (
            <PagerView ref={bookPagerRef} style={{ flex: 1 }} initialPage={bookSections.length > 0 ? bookSections.length - 1 : 0}>
              {bookSections.map((section, pageIndex) => {
                const { year, monthDay, dayOfWeek } = formatBookDate(section.title)
                return (
                  <View key={section.title} style={styles.bookPage}>
                    <View style={styles.bookHeader}>
                      <Text style={styles.bookMonthDay}>{monthDay}</Text>
                      <Text style={styles.bookDayOfWeek}>{dayOfWeek}　{year}</Text>
                      <View style={styles.bookHeaderLine} />
                    </View>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.bookScrollContent} showsVerticalScrollIndicator={false}>
                      {section.data.map((diary, entryIndex) => (
                        <View key={diary.id}>
                          <Text style={styles.bookTimeSingle}>{formatTime(diary.created_at)}</Text>
                          {diary.content.split('\n').map((line, j) => (
                            <Text key={j} style={styles.bookText}>{line || ' '}</Text>
                          ))}
                          {diary.photos?.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bookPhotoRow} contentContainerStyle={{ gap: 6 }}>
                              {diary.photos.map((url, pi) => (
                                <TouchableOpacity key={pi} onPress={() => setSelectedPhoto(url)} activeOpacity={0.85}>
                                  <Image source={{ uri: url }} style={styles.bookPhoto} />
                                  {pi === 0 && diary.photos!.length > 1 && (
                                    <View style={styles.bookPhotoCount}>
                                      <Ionicons name="images-outline" size={10} color="#fff" />
                                      <Text style={styles.bookPhotoCountText}>{diary.photos!.length}</Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          )}
                          {diary.tags?.length > 0 && (
                            <View style={styles.bookTagsRow}>
                              {diary.tags.map((tag, ti) => (
                                <View key={ti} style={[styles.bookTagChip, { backgroundColor: accentBg }]}>
                                  <Text style={[styles.bookTagText, { color: accent }]}>#{tag}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                          {entryIndex < section.data.length - 1 && <View style={{ height: 32 }} />}
                        </View>
                      ))}
                    </ScrollView>
                    <Text style={styles.bookPageNum}>{pageIndex + 1} / {bookSections.length}</Text>
                  </View>
                )
              })}
            </PagerView>
          )}
          </Animated.View>
        </View>

      <Modal visible={!!selectedPhoto} transparent animationType="fade">
        <View style={styles.photoOverlay}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri: selectedPhoto! }}
              style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.85 }}
              resizeMode="contain"
            />
          </ScrollView>
          <TouchableOpacity style={styles.photoCloseBtn} onPress={() => setSelectedPhoto(null)}>
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg },
    emptyText: { fontSize: 16, color: t.sub, fontWeight: '500' },
    emptyHint: { fontSize: 14, color: t.sub, marginTop: 8 },
    listContent: { padding: 16, paddingBottom: 32 },


    toolbar: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.card, paddingHorizontal: 12, paddingVertical: 8,
      gap: 8, borderBottomWidth: 1, borderBottomColor: t.border,
    },
    searchBar: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: t.inputBg, borderRadius: 10,
      paddingHorizontal: 10, paddingVertical: 7,
    },
    searchInput: { flex: 1, fontSize: 13, color: t.text, paddingVertical: 0 },
    sortButton: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: t.inputBg },
    viewToggle: { flexDirection: 'row', gap: 6 },
    toggleBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: t.inputBg },
    toggleBtnActive: { backgroundColor: t.accentBg },

    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    pickerCard: {
      backgroundColor: t.card, borderRadius: 20, width: 280,
      paddingVertical: 8, overflow: 'hidden',
    },
    jumpPickerCard: {
      backgroundColor: t.card, borderRadius: 20, width: '92%', overflow: 'hidden',
    },
    jumpPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
    pickerTitle: { fontSize: 13, color: t.sub, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 20, paddingVertical: 10 },
    pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
    pickerItemActive: { backgroundColor: t.accentBg },
    pickerItemText: { fontSize: 15, color: t.text },
    pickerItemTextActive: { color: t.accent, fontWeight: '700' },

    tagFilterBar: { backgroundColor: t.card, borderBottomWidth: 1, borderBottomColor: t.border },
    tagFilterChip: {
      borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7,
      backgroundColor: t.inputBg, borderWidth: 1, borderColor: t.border,
    },
    tagFilterChipActive: { backgroundColor: t.accentBg, borderColor: t.accentBorder },
    tagFilterText: { fontSize: 13, fontWeight: '600', color: t.sub },
    tagFilterTextActive: { color: t.accent },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 6 },
    sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: t.accent, flex: 1 },
    sectionCount: { fontSize: 12, color: t.accentLight, fontWeight: '600' },


    bookPage: { flex: 1, backgroundColor: t.card },
    bookHeader: { alignItems: 'center', paddingTop: 20, paddingBottom: 12, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: t.accentBg },
    bookMonthDay: { fontSize: 20, fontWeight: '700', color: t.text, letterSpacing: 0.5 },
    bookDayOfWeek: { fontSize: 12, color: t.sub, marginTop: 2, letterSpacing: 0.5 },
    bookHeaderLine: { width: 32, height: 2, backgroundColor: t.accent, marginTop: 10, borderRadius: 1 },
    bookScrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
    bookTimeSingle: { fontSize: 12, color: t.accent, fontWeight: '600', marginBottom: 14, letterSpacing: 0.5 },
    bookText: { fontSize: 17, color: t.text, lineHeight: 30 },
    bookPhotoRow: { marginTop: 16 },
    bookPhoto: { width: 150, height: 110, borderRadius: 12 },
    bookPhotoCount: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 99, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3 },
    bookPhotoCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    bookPageNum: { textAlign: 'center', fontSize: 12, color: t.sub, paddingVertical: 12, letterSpacing: 1 },
    bookTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
    bookTagChip: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
    bookTagText: { fontSize: 11, fontWeight: '500' },

    photoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
    photoCloseBtn: { position: 'absolute', top: 56, right: 20, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  })
}
