import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { Calendar } from 'react-native-calendars'
import { useState, useCallback, useRef } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { supabase } from '../../utils/supabase'
import PagerView from 'react-native-pager-view'

type Diary = {
  id: string
  title: string
  content: string
  date: string
  created_at: string
}

const formatTime = (created_at: string) => {
  const date = new Date(created_at)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const getAdjacentDate = (dateString: string, days: number) => {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

export default function CalendarScreen() {
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({})
  const [selectedDate, setSelectedDate] = useState('')
  const [pages, setPages] = useState<{ date: string; diaries: Diary[]; loading: boolean }[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const pagerRef = useRef<PagerView>(null)
  const router = useRouter()

  useFocusEffect(
    useCallback(() => {
      fetchAllDates()
    }, [])
  )

  const fetchAllDates = async () => {
    const { data, error } = await supabase
      .from('diaries')
      .select('date')

    if (error) { console.error(error); return }

    const marks: Record<string, any> = {}
    data.forEach(d => {
      marks[d.date] = { marked: true, dotColor: '#1D9E75' }
    })

    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: '#1D9E75',
      }
    }

    setMarkedDates(marks)
  }

  const fetchDiariesForDate = async (date: string): Promise<Diary[]> => {
    const { data, error } = await supabase
      .from('diaries')
      .select('*')
      .eq('date', date)
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return data
  }

  const onDayPress = async (day: { dateString: string }) => {
    const date = day.dateString
    setSelectedDate(date)

    setMarkedDates(prev => {
      const next: Record<string, any> = {}
      Object.keys(prev).forEach(k => {
        next[k] = { ...prev[k], selected: false }
      })
      return {
        ...next,
        [date]: {
          ...prev[date],
          selected: true,
          selectedColor: '#1D9E75',
        }
      }
    })

    // 3ページ分（前日・当日・翌日）を並列で取得
    const prevDate = getAdjacentDate(date, -1)
    const nextDate = getAdjacentDate(date, 1)

    const newPages = [
      { date: prevDate, diaries: [], loading: true },
      { date: date, diaries: [], loading: true },
      { date: nextDate, diaries: [], loading: true },
    ]
    setPages(newPages)
    setCurrentPage(1)

    // pagerを真ん中に移動
    setTimeout(() => {
      pagerRef.current?.setPageWithoutAnimation(1)
    }, 0)

    // 並列取得
    const [prevDiaries, currDiaries, nextDiaries] = await Promise.all([
      fetchDiariesForDate(prevDate),
      fetchDiariesForDate(date),
      fetchDiariesForDate(nextDate),
    ])

    setPages([
      { date: prevDate, diaries: prevDiaries, loading: false },
      { date: date, diaries: currDiaries, loading: false },
      { date: nextDate, diaries: nextDiaries, loading: false },
    ])
  }

  const onPageSelected = async (e: any) => {
    const position = e.nativeEvent.position
    if (position === currentPage) return

    const newCenterDate = pages[position].date
    setSelectedDate(newCenterDate)
    setCurrentPage(1)

    setMarkedDates(prev => {
      const next: Record<string, any> = {}
      Object.keys(prev).forEach(k => {
        next[k] = { ...prev[k], selected: false }
      })
      return {
        ...next,
        [newCenterDate]: {
          ...prev[newCenterDate],
          selected: true,
          selectedColor: '#1D9E75',
        }
      }
    })

    const prevDate = getAdjacentDate(newCenterDate, -1)
    const nextDate = getAdjacentDate(newCenterDate, 1)

    const newPages = [
      { date: prevDate, diaries: [], loading: true },
      { date: newCenterDate, diaries: pages[position].diaries, loading: false },
      { date: nextDate, diaries: [], loading: true },
    ]
    setPages(newPages)

    setTimeout(() => {
      pagerRef.current?.setPageWithoutAnimation(1)
    }, 0)

    const [prevDiaries, nextDiaries] = await Promise.all([
      fetchDiariesForDate(prevDate),
      fetchDiariesForDate(nextDate),
    ])

    setPages([
      { date: prevDate, diaries: prevDiaries, loading: false },
      { date: newCenterDate, diaries: pages[position].diaries, loading: false },
      { date: nextDate, diaries: nextDiaries, loading: false },
    ])
  }

  return (
    <View style={styles.container}>
      <Calendar
        onDayPress={onDayPress}
        markedDates={markedDates}
        theme={{
          todayTextColor: '#1D9E75',
          selectedDayBackgroundColor: '#1D9E75',
          arrowColor: '#1D9E75',
          dotColor: '#1D9E75',
        }}
      />

      {selectedDate && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push(`/diary/new?date=${selectedDate}`)}
        >
          <Text style={styles.createButtonText}>＋　この日の日記を書く</Text>
        </TouchableOpacity>
      )}

      {!selectedDate && (
        <Text style={styles.hint}>日付をタップすると日記を確認できます</Text>
      )}

      {selectedDate && pages.length > 0 && (
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={1}
          onPageSelected={onPageSelected}
        >
          {pages.map((page, index) => (
            <View key={index} style={styles.page}>
              <View style={styles.dateNavRow}>
                <Text style={styles.selectedDateText}>{page.date}</Text>
              </View>

              <ScrollView>
                {page.loading && (
                  <ActivityIndicator color="#1D9E75" style={{ marginTop: 24 }} />
                )}

                {!page.loading && page.diaries.length === 0 && (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>この日の日記はありません</Text>
                  </View>
                )}

                {!page.loading && page.diaries.map((diary, i) => (
                  <TouchableOpacity
                    key={diary.id}
                    style={styles.card}
                    onPress={() => router.push(`/diary/${diary.id}`)}
                  >
                    <Text style={styles.cardDate}>
                      {formatTime(diary.created_at)}　{i + 1}件目
                    </Text>
                    <Text style={styles.cardContent} numberOfLines={3}>
                      {diary.content}
                    </Text>
                    {diary.content.length > 60 && (
                      <Text style={styles.more}>続きを読む →</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}
        </PagerView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  hint: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 24,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: 16,
  },
  dateNavRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F8F3',
    marginBottom: 10,
    alignItems: 'center',
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D9E75',
    letterSpacing: 0.5,
  },
  empty: {
    padding: 16,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#ddd',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#aaa',
  },
  card: {
    padding: 16,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#1D9E75',
    marginBottom: 10,
  },
  cardDate: {
    fontSize: 13,
    color: '#1D9E75',
    marginBottom: 10,
    fontWeight: '500',
  },
  cardContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 26,
  },
  more: {
    fontSize: 13,
    color: '#1D9E75',
    marginTop: 6,
    textAlign: 'right',
  },
  createButton: {
    backgroundColor: '#1D9E75',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    shadowColor: '#1D9E75',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
})