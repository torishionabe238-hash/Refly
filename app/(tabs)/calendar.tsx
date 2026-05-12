import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Animated, Easing, PanResponder, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import AuroraGradient from '../../components/AuroraGradient'
import { Calendar } from 'react-native-calendars'
import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../../utils/supabase'
import PagerView from 'react-native-pager-view'
import BottomSheet from '../../components/BottomSheet'
import ThinkingIndicator from '../../components/ThinkingIndicator'
import DiaryCard from '../../components/DiaryCard'
import { Ionicons } from '@expo/vector-icons'
import { stripHtml } from '../diary/[id]'
import { useTheme, Theme } from '../../utils/theme'

const MASTRA_URL = 'http://10.1.62.38:4111'
const SCREEN_WIDTH = Dimensions.get('window').width
// 6行分のグリッド高さを基準に dayHeight を計算（月ごとに行数で割って均等化）
const DAY_GRID_H = 6 * 62

const getWeekRows = (monthStr: string) => {
  const [year, month] = monthStr.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  return Math.ceil((firstDay + daysInMonth) / 7)
}

type Diary = {
  id: string
  title: string
  content: string
  date: string
  created_at: string
}

type EpisodeContent = {
  episodeText: string
  points: string[]
}

const getAdjacentDate = (dateString: string, days: number) => {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
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

const addMonths = (dateStr: string, delta: number) => {
  const d = new Date(dateStr)
  d.setDate(1)
  d.setMonth(d.getMonth() + delta)
  return d.toISOString().split('T')[0]
}

const buildRangeMarks = (start: string, end: string, accent: string, accentBorder: string): Record<string, any> => {
  const marks: Record<string, any> = {}
  const cur = new Date(start)
  const endDate = new Date(end)
  while (cur <= endDate) {
    const d = cur.toISOString().split('T')[0]
    const isStart = d === start, isEnd = d === end
    if (isStart && isEnd) marks[d] = { startingDay: true, endingDay: true, color: accent, textColor: '#fff' }
    else if (isStart) marks[d] = { startingDay: true, color: accent, textColor: '#fff' }
    else if (isEnd) marks[d] = { endingDay: true, color: accent, textColor: '#fff' }
    else marks[d] = { color: accentBorder, textColor: accent }
    cur.setDate(cur.getDate() + 1)
  }
  return marks
}

export default function CalendarScreen() {
  const theme = useTheme()
  const { accent, accentBg, accentBorder, accentLight, gradientEnd, card, text, sub, border } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])

  const [rawMarks, setRawMarks] = useState<Record<string, any>>({})
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [currentMonth, setCurrentMonth] = useState(today)
  const weekRows = useMemo(() => getWeekRows(currentMonth), [currentMonth])
  const dayHeight = Math.floor(DAY_GRID_H / weekRows)
  const measuredCalH = useRef(0)
  const [calContainerH, setCalContainerH] = useState(0)
  const onCalLayout = useCallback((e: any) => {
    const h = Math.round(e.nativeEvent.layout.height)
    if (h > 100 && h !== measuredCalH.current) {
      measuredCalH.current = h
      setCalContainerH(prev => Math.max(prev, h))
    }
  }, [])
  const markedDates = useMemo(() => {
    const result: Record<string, any> = {}
    Object.keys(rawMarks).forEach(date => {
      result[date] = { marked: true, dotColor: accent }
    })
    if (selectedDate) {
      result[selectedDate] = {
        ...(result[selectedDate] ?? {}),
        selected: true,
        selectedColor: accent,
        selectedDotColor: '#fff',
      }
    }
    return result
  }, [rawMarks, selectedDate, accent])
  const [pages, setPages] = useState<{ date: string; diaries: Diary[]; loading: boolean }[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const pagerRef = useRef<PagerView>(null)
  const router = useRouter()
  const diaryCache = useRef<Map<string, Diary[]>>(new Map())
  const lastMarksFetch = useRef(0)
  const selectedDateRef = useRef(today)

  const calTheme = useMemo(() => ({
    backgroundColor: card,
    calendarBackground: card,
    dayTextColor: text,
    monthTextColor: text,
    textSectionTitleColor: sub,
    textDisabledColor: sub,
    todayTextColor: accent,
    selectedDayBackgroundColor: accent,
    selectedDayTextColor: '#fff',
    arrowColor: accent,
    dotColor: accent,
    selectedDotColor: '#fff',
    dayHeight,
    // カレンダー内蔵ヘッダーを非表示にする
    'stylesheet.calendar.header': {
      header: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 0, alignItems: 'center', marginHorizontal: -2, paddingBottom: 0 },
      headerContainer: { height: 0, overflow: 'hidden' },
    },
    'stylesheet.calendar.main': {
      container: { backgroundColor: card },
    },
  }), [accent, card, text, sub, dayHeight])

  const slideAnim = useRef(new Animated.Value(0)).current
  const currentMonthRef = useRef(today)
  const isAnimating = useRef(false)

  useEffect(() => { currentMonthRef.current = currentMonth }, [currentMonth])
  useEffect(() => { selectedDateRef.current = selectedDate }, [selectedDate])

  const slideMonth = useCallback((direction: number) => {
    if (isAnimating.current) return
    isAnimating.current = true
    const newMonth = addMonths(currentMonthRef.current, direction)

    Animated.timing(slideAnim, {
      toValue: -direction * SCREEN_WIDTH,
      duration: 70,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(direction * SCREEN_WIDTH)
      currentMonthRef.current = newMonth
      setCurrentMonth(newMonth)
      isAnimating.current = false
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 180,
        friction: 20,
      }).start()
    })
  }, [])

  const slideMonthRef = useRef(slideMonth)
  useEffect(() => { slideMonthRef.current = slideMonth }, [slideMonth])

  const jumpToToday = useCallback(() => {
    currentMonthRef.current = today
    setCurrentMonth(today)
    setSelectedDate(today)
    diaryCache.current.delete(today)
    refreshPages(today)
  }, [])

  const navigation = useNavigation()
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={jumpToToday} style={{ marginLeft: 16 }}>
          <Text style={{ color: accent, fontSize: 14, fontWeight: '600' }}>今日</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push('/(tabs)/list')} style={{ marginRight: 16 }}>
          <Ionicons name="search-outline" size={22} color={accent} />
        </TouchableOpacity>
      ),
    })
  }, [accent])

  const calPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => {
      if (!isAnimating.current) slideAnim.setValue(g.dx * 0.8)
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -30 || g.vx < -0.3) slideMonthRef.current(1)
      else if (g.dx > 30 || g.vx > 0.3) slideMonthRef.current(-1)
      else Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 180, friction: 20 }).start()
    },
  })).current

  const [monthPickerVisible, setMonthPickerVisible] = useState(false)
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear())

  const [episodeSheetVisible, setEpisodeSheetVisible] = useState(false)
  const [episodeLoading, setEpisodeLoading] = useState(false)
  const [episode, setEpisode] = useState<EpisodeContent | null>(null)
  const [episodeSaving, setEpisodeSaving] = useState(false)
  const [episodeSaved, setEpisodeSaved] = useState(false)
  const [currentEpisodeDate, setCurrentEpisodeDate] = useState('')
  const [currentEpisodeDiaryCount, setCurrentEpisodeDiaryCount] = useState(0)

  const [rangeSheetVisible, setRangeSheetVisible] = useState(false)
  const [rangeStart, setRangeStart] = useState<string | null>(null)
  const [rangeEnd, setRangeEnd] = useState<string | null>(null)
  const [rangeMarks, setRangeMarks] = useState<Record<string, any>>({})
  const [rangeDiaryCount, setRangeDiaryCount] = useState<number | null>(null)
  const [rangeCountLoading, setRangeCountLoading] = useState(false)

  useFocusEffect(useCallback(() => {
    const sd = selectedDateRef.current
    diaryCache.current.clear()
    const now = Date.now()
    if (now - lastMarksFetch.current > 60_000) {
      lastMarksFetch.current = now
      fetchAllDates()
    }
    if (sd) refreshPages(sd)
  }, []))

  const refreshPages = async (centerDate: string) => {
    const prevDate = getAdjacentDate(centerDate, -1)
    const nextDate = getAdjacentDate(centerDate, 1)
    const [prev, curr, next] = await Promise.all([
      fetchDiariesForDate(prevDate), fetchDiariesForDate(centerDate), fetchDiariesForDate(nextDate),
    ])
    setPages([
      { date: prevDate, diaries: prev, loading: false },
      { date: centerDate, diaries: curr, loading: false },
      { date: nextDate, diaries: next, loading: false },
    ])
  }

  const fetchAllDates = async () => {
    const { data, error } = await supabase.from('diaries').select('date')
    if (error) return
    const marks: Record<string, any> = {}
    data.forEach(d => { marks[d.date] = { marked: true } })
    setRawMarks(marks)
  }

  const fetchDiariesForDate = async (date: string): Promise<Diary[]> => {
    const cached = diaryCache.current.get(date)
    if (cached) return cached
    const { data, error } = await supabase.from('diaries').select('*').eq('date', date).order('created_at', { ascending: false })
    const result = error || !data ? [] : data
    diaryCache.current.set(date, result)
    return result
  }

  const callMastra = async (content: string, threadId: string): Promise<EpisodeContent> => {
    const res = await fetch(`${MASTRA_URL}/api/agents/episodify-agent/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content }], threadId, resourceId: 'refly-user' }),
    })
    const data = await res.json()
    const raw = data.text ?? data.content ?? data.output ?? data.result ?? ''
    if (!raw) throw new Error('empty response')
    return parseEpisodeContent(raw)
  }

  const generateEpisode = async (diaries: Diary[], date: string) => {
    if (diaries.length === 0) return
    setEpisode(null); setEpisodeSaved(false)
    setCurrentEpisodeDate(date); setCurrentEpisodeDiaryCount(diaries.length)
    setEpisodeLoading(true); setEpisodeSheetVisible(true)
    const content = diaries.length === 1
      ? stripHtml(diaries[0].content)
      : diaries.map((d, i) => `【日記${i + 1}】\n${stripHtml(d.content)}`).join('\n\n')
    try {
      setEpisode(await callMastra(content, `episodify-${date}-${Date.now()}`))
    } catch (_e) {
      Alert.alert('エラー', 'エピソード化に失敗しました')
      setEpisodeSheetVisible(false)
    } finally {
      setEpisodeLoading(false)
    }
  }

  const generateRangeEpisode = async () => {
    if (!rangeStart || !rangeEnd) return
    setRangeSheetVisible(false)
    setTimeout(async () => {
      setEpisode(null); setEpisodeSaved(false)
      setCurrentEpisodeDate(`${rangeStart}〜${rangeEnd}`)
      setCurrentEpisodeDiaryCount(rangeDiaryCount ?? 0)
      setEpisodeLoading(true); setEpisodeSheetVisible(true)
      try {
        const { data: diaries } = await supabase
          .from('diaries').select('content, date')
          .gte('date', rangeStart).lte('date', rangeEnd)
          .order('date', { ascending: true })
        if (!diaries || diaries.length === 0) {
          Alert.alert('日記なし', 'この期間に日記がありません')
          setEpisodeSheetVisible(false); return
        }
        const content = diaries.map((d, i) => `【${d.date} / 日記${i + 1}】\n${d.content}`).join('\n\n')
        setEpisode(await callMastra(content, `episodify-range-${rangeStart}-${rangeEnd}-${Date.now()}`))
      } catch (_e) {
        Alert.alert('エラー', 'エピソード化に失敗しました')
        setEpisodeSheetVisible(false)
      } finally {
        setEpisodeLoading(false)
      }
    }, 300)
  }

  const onRangeDayPress = async (day: { dateString: string }) => {
    const d = day.dateString
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d); setRangeEnd(null)
      setRangeMarks({ [d]: { startingDay: true, endingDay: true, color: accent, textColor: '#fff' } })
      setRangeDiaryCount(null)
    } else {
      const start = rangeStart <= d ? rangeStart : d
      const end = rangeStart <= d ? d : rangeStart
      setRangeStart(start); setRangeEnd(end)
      setRangeMarks(buildRangeMarks(start, end, accent, accentBorder))
      setRangeCountLoading(true)
      const { count } = await supabase.from('diaries').select('*', { count: 'exact', head: true }).gte('date', start).lte('date', end)
      setRangeDiaryCount(count ?? 0)
      setRangeCountLoading(false)
    }
  }

  const saveEpisode = async () => {
    if (!episode) return
    setEpisodeSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { error } = await supabase.from('episodes').insert({
        user_id: session.user.id, date: currentEpisodeDate,
        episode_text: episode.episodeText, points: episode.points,
        diary_count: currentEpisodeDiaryCount,
      })
      if (error) throw error
      setEpisodeSaved(true)
    } catch (_e) {
      Alert.alert('エラー', '保存に失敗しました')
    } finally {
      setEpisodeSaving(false)
    }
  }

  const onDayPress = async (day: { dateString: string }) => {
    const date = day.dateString
    // 別の月の日付をタップしたらその月にスライド
    if (date.substring(0, 7) !== currentMonthRef.current.substring(0, 7)) {
      const direction = date.substring(0, 7) > currentMonthRef.current.substring(0, 7) ? 1 : -1
      slideMonth(direction)
    }
    setSelectedDate(date)
    const prevDate = getAdjacentDate(date, -1)
    const nextDate = getAdjacentDate(date, 1)
    setPages([
      { date: prevDate, diaries: [], loading: true },
      { date, diaries: [], loading: true },
      { date: nextDate, diaries: [], loading: true },
    ])
    setCurrentPage(1)
    setTimeout(() => pagerRef.current?.setPageWithoutAnimation(1), 0)
    const [prev, curr, next] = await Promise.all([
      fetchDiariesForDate(prevDate), fetchDiariesForDate(date), fetchDiariesForDate(nextDate),
    ])
    setPages([
      { date: prevDate, diaries: prev, loading: false },
      { date, diaries: curr, loading: false },
      { date: nextDate, diaries: next, loading: false },
    ])
  }

  const onPageSelected = async (e: any) => {
    const position = e.nativeEvent.position
    if (position === currentPage) return
    const newCenter = pages[position].date
    // 日付が月を跨いだらカレンダーヘッダーも更新
    if (newCenter.substring(0, 7) !== currentMonthRef.current.substring(0, 7)) {
      const newMonthDate = newCenter.substring(0, 8) + '01'
      currentMonthRef.current = newMonthDate
      setCurrentMonth(newMonthDate)
    }
    setSelectedDate(newCenter)
    setCurrentPage(1)
    const prevDate = getAdjacentDate(newCenter, -1)
    const nextDate = getAdjacentDate(newCenter, 1)
    setPages([
      { date: prevDate, diaries: [], loading: true },
      { date: newCenter, diaries: pages[position].diaries, loading: false },
      { date: nextDate, diaries: [], loading: true },
    ])
    setTimeout(() => pagerRef.current?.setPageWithoutAnimation(1), 0)
    const [prev, next] = await Promise.all([fetchDiariesForDate(prevDate), fetchDiariesForDate(nextDate)])
    setPages([
      { date: prevDate, diaries: prev, loading: false },
      { date: newCenter, diaries: pages[position].diaries, loading: false },
      { date: nextDate, diaries: next, loading: false },
    ])
  }

  return (
    <View style={styles.container}>
      {/* 固定ヘッダー：スワイプしない */}
      <View style={styles.monthNavRow}>
        <TouchableOpacity style={styles.monthArrowBtn} onPress={() => slideMonth(-1)}>
          <Ionicons name="chevron-back" size={22} color={accent} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.calHeader}
          onPress={() => {
            setPickerYear(parseInt(currentMonth.split('-')[0]))
            setMonthPickerVisible(true)
          }}
        >
          <Text style={styles.calHeaderText}>
            {parseInt(currentMonth.split('-')[0])}年{parseInt(currentMonth.split('-')[1])}月
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.monthArrowBtn} onPress={() => slideMonth(1)}>
          <Ionicons name="chevron-forward" size={22} color={accent} />
        </TouchableOpacity>
      </View>

      {/* カレンダーグリッドのみスワイプアニメーション */}
      <View
        style={{ backgroundColor: card, height: calContainerH > 0 ? calContainerH : undefined, overflow: 'hidden' }}
        {...calPan.panHandlers}
      >
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }} onLayout={onCalLayout}>
          <Calendar
            key={`${currentMonth}-${card}`}
            current={currentMonth}
            onDayPress={onDayPress}
            markedDates={markedDates}
            hideArrows={true}
            renderHeader={() => null}
            theme={calTheme}
          />
        </Animated.View>
      </View>

      <View style={styles.actionArea}>
        <View style={styles.actionRow}>
          {selectedDate && (
            <TouchableOpacity style={styles.createButton} onPress={() => router.push(`/diary/new?date=${selectedDate}`)}>
              <Text style={styles.createButtonText}>＋　この日の日記を書く</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.rangeLink}
          onPress={() => {
            setRangeStart(null); setRangeEnd(null)
            setRangeMarks({}); setRangeDiaryCount(null)
            setRangeSheetVisible(true)
          }}
        >
          <Ionicons name="calendar-outline" size={14} color={accent} />
          <Text style={styles.rangeLinkText}>期間を指定してエピソード化</Text>
        </TouchableOpacity>
      </View>

      {selectedDate && pages.length > 0 && (
        <PagerView ref={pagerRef} style={styles.pager} initialPage={1} onPageSelected={onPageSelected}>
          {pages.map((page, index) => (
            <View key={index} style={styles.page}>
              <ScrollView>
                {page.loading && <ActivityIndicator color={accent} style={{ marginTop: 24 }} />}
                {!page.loading && page.diaries.length === 0 && (
                  <View style={styles.empty}><Text style={styles.emptyText}>この日の日記はありません</Text></View>
                )}
                {!page.loading && page.diaries.map((diary, i) => (
                  <DiaryCard
                    key={diary.id}
                    diary={diary}
                    index={i}
                    showIndex
                    onPress={() => router.push(`/diary/${diary.id}`)}
                  />
                ))}
                {!page.loading && page.diaries.length > 0 && (
                  <AuroraGradient
                    colors={[accent, gradientEnd]}
                    style={styles.episodeButtonGrad}
                  >
                    <TouchableOpacity style={styles.episodeButton} onPress={() => generateEpisode(page.diaries, page.date)}>
                      <Ionicons name="sparkles-outline" size={22} color="#fff" />
                      <View>
                        <Text style={styles.episodeButtonText}>この日の日記をエピソード化</Text>
                        <Text style={styles.episodeButtonSub}>{page.diaries.length}件の日記をまとめます</Text>
                      </View>
                    </TouchableOpacity>
                  </AuroraGradient>
                )}
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          ))}
        </PagerView>
      )}

      {/* 月ピッカー */}
      <BottomSheet
        visible={monthPickerVisible}
        onClose={() => setMonthPickerVisible(false)}
        title="月を選択"
        titleIcon={<Ionicons name="calendar-outline" size={18} color={accent} />}
      >
        <View style={styles.pickerYearRow}>
          <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={styles.pickerArrow}>
            <Text style={styles.pickerArrowText}>＜</Text>
          </TouchableOpacity>
          <Text style={styles.pickerYear}>{pickerYear}年</Text>
          <TouchableOpacity onPress={() => setPickerYear(y => y + 1)} style={styles.pickerArrow}>
            <Text style={styles.pickerArrowText}>＞</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.pickerMonthGrid}>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
            const isSelected =
              parseInt(currentMonth.split('-')[0]) === pickerYear &&
              parseInt(currentMonth.split('-')[1]) === m
            return (
              <TouchableOpacity
                key={m}
                style={[styles.pickerMonthCell, isSelected && styles.pickerMonthCellActive]}
                onPress={() => {
                  const newMonth = `${pickerYear}-${String(m).padStart(2, '0')}-01`
                  currentMonthRef.current = newMonth
                  setCurrentMonth(newMonth)
                  setMonthPickerVisible(false)
                }}
              >
                <Text style={[styles.pickerMonthText, isSelected && styles.pickerMonthTextActive]}>
                  {m}月
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={{ height: 16 }} />
      </BottomSheet>

      {/* 期間指定シート */}
      <BottomSheet
        visible={rangeSheetVisible}
        onClose={() => setRangeSheetVisible(false)}
        title="期間でエピソード化"
        titleIcon={<Ionicons name="calendar-outline" size={18} color={accent} />}
        hideCloseButton
        maxHeight="85%"
      >
        <View style={styles.rangeInstruction}>
          <Text style={styles.rangeInstructionText}>
            {!rangeStart ? '開始日をタップ' : !rangeEnd ? '終了日をタップ' : `${rangeStart}  〜  ${rangeEnd}`}
          </Text>
          {rangeCountLoading
            ? <ActivityIndicator color={accent} size="small" />
            : rangeDiaryCount !== null && <Text style={styles.rangeDiaryCount}>{rangeDiaryCount}件</Text>
          }
        </View>
        <Calendar
          key={`range-${card}-${accent}`}
          onDayPress={onRangeDayPress}
          markedDates={rangeMarks}
          markingType="period"
          theme={{ todayTextColor: accent, arrowColor: accent, calendarBackground: card, dayTextColor: text, textDisabledColor: sub }}
        />
        <TouchableOpacity
          style={[styles.rangeGenerateButton, (!rangeStart || !rangeEnd || rangeDiaryCount === 0) && styles.disabledButton]}
          onPress={generateRangeEpisode}
          disabled={!rangeStart || !rangeEnd || rangeDiaryCount === 0}
        >
          <Text style={styles.rangeGenerateButtonText}>
            {rangeDiaryCount === 0 ? 'この期間に日記がありません' : 'エピソード化する'}
          </Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* エピソードシート */}
      <BottomSheet
        visible={episodeSheetVisible}
        onClose={() => !episodeLoading && setEpisodeSheetVisible(false)}
        title="エピソードトーク"
        titleIcon={<Ionicons name="sparkles-outline" size={18} color={accent} />}
        disableClose={episodeLoading}
      >
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {episodeLoading ? (
            <View style={styles.loadingContainer}>
              <ThinkingIndicator steps={[
                '日記を読み込んでいます...',
                '面白いポイントを探しています...',
                'エピソードの構成を考えています...',
                'フリとオチを整えています...',
                '話し言葉に仕上げています...',
                'もう少しで完成です...',
              ]} />
            </View>
          ) : episode ? (
            <View style={styles.episodeContent}>
              <View style={styles.episodeTextCard}>
                <View style={styles.sectionLabelRow}>
                  <Ionicons name="book-outline" size={13} color={accent} />
                  <Text style={styles.sectionLabel}>エピソード</Text>
                </View>
                <Text style={styles.episodeText}>{episode.episodeText}</Text>
              </View>
              {episode.points.length > 0 && (
                <View style={styles.pointsCard}>
                  <View style={styles.sectionLabelRow}>
                    <Ionicons name="bulb-outline" size={13} color={accent} />
                    <Text style={styles.sectionLabel}>話すときのポイント</Text>
                  </View>
                  {episode.points.map((point, i) => (
                    <View key={i} style={styles.pointRow}>
                      <View style={styles.pointBadge}><Text style={styles.pointBadgeText}>{i + 1}</Text></View>
                      <Text style={styles.pointText}>{point}</Text>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity
                style={[styles.saveButton, episodeSaved && styles.saveButtonDone]}
                onPress={saveEpisode}
                disabled={episodeSaving || episodeSaved}
              >
                <Text style={styles.saveButtonText}>
                  {episodeSaved
                    ? <><Ionicons name="checkmark" size={16} color="#fff" />{'　保存済み'}</>
                    : episodeSaving ? '保存中...'
                    : <><Ionicons name="bookmark-outline" size={16} color="#fff" />{'　エピソードを保存する'}</>
                  }
                </Text>
              </TouchableOpacity>
              <View style={{ height: 8 }} />
            </View>
          ) : null}
        </ScrollView>
      </BottomSheet>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.card },

    monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 6, backgroundColor: t.card },
    monthArrowBtn: { padding: 8 },
    calHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
    calHeaderText: { fontSize: 17, fontWeight: '700', color: t.text },

    actionArea: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 4, gap: 6 },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    todayBtn: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: t.accentBorder, backgroundColor: t.accentBg },
    todayBtnText: { fontSize: 13, color: t.accent, fontWeight: '600' },
    createButton: {
      flex: 1, backgroundColor: t.accent, padding: 12, borderRadius: 16, alignItems: 'center',
    },
    createButtonText: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
    rangeLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
    rangeLinkText: { fontSize: 13, color: t.accent, fontWeight: '500' },

    pickerYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 16 },
    pickerArrow: { padding: 8 },
    pickerArrowText: { fontSize: 18, color: t.accent, fontWeight: '700' },
    pickerYear: { fontSize: 20, fontWeight: '700', color: t.text, minWidth: 80, textAlign: 'center' },
    pickerMonthGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
    pickerMonthCell: { width: '22%', paddingVertical: 12, borderRadius: 12, backgroundColor: t.inputBg, alignItems: 'center' },
    pickerMonthCellActive: { backgroundColor: t.accent },
    pickerMonthText: { fontSize: 15, fontWeight: '600', color: t.sub },
    pickerMonthTextActive: { color: '#fff' },

    pager: { flex: 1 },
    page: { flex: 1, paddingHorizontal: 16 },

    dateNavRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.accentBg, marginBottom: 10, alignItems: 'center' },
    selectedDateText: { fontSize: 16, fontWeight: '600', color: t.accent, letterSpacing: 0.5 },

    empty: { padding: 16, backgroundColor: t.inputBg, borderRadius: 12, borderWidth: 0.5, borderColor: t.border, marginTop: 8 },
    emptyText: { fontSize: 15, color: t.sub },

    episodeButtonGrad: {
      borderRadius: 16, marginTop: 4, marginBottom: 8,
    },
    episodeButton: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    episodeButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    episodeButtonSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

    rangeInstruction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 16, padding: 12, backgroundColor: t.accentBg, borderRadius: 12, gap: 8 },
    rangeInstructionText: { fontSize: 14, color: t.accent, fontWeight: '600', flex: 1 },
    rangeDiaryCount: { fontSize: 13, color: t.accentLight, fontWeight: '600' },
    rangeGenerateButton: { backgroundColor: t.accent, margin: 16, borderRadius: 14, padding: 14, alignItems: 'center' },
    rangeGenerateButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
    disabledButton: { backgroundColor: t.sub },

    sheetScroll: { paddingHorizontal: 20 },
    loadingContainer: { alignItems: 'center', paddingVertical: 52, gap: 14 },
    loadingTitle: { fontSize: 16, fontWeight: '600', color: t.accent },
    loadingSubtitle: { fontSize: 14, color: t.sub, textAlign: 'center', lineHeight: 22 },
    episodeContent: { paddingTop: 16, gap: 14 },
    episodeTextCard: { backgroundColor: t.accentBg, borderRadius: 16, padding: 18, borderLeftWidth: 3, borderLeftColor: t.accent, gap: 10 },
    pointsCard: { backgroundColor: t.inputBg, borderRadius: 16, padding: 18, gap: 12 },
    sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: t.accent, letterSpacing: 0.5, textTransform: 'uppercase' },
    episodeText: { fontSize: 16, color: t.text, lineHeight: 28 },
    pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    pointBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
    pointBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
    pointText: { fontSize: 15, color: t.text, lineHeight: 24, flex: 1 },
    saveButton: { backgroundColor: t.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 4 },
    saveButtonDone: { backgroundColor: t.accentLight },
    saveButtonText: { fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: 0.3 },
  })
}
