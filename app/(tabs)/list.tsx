import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '../../utils/supabase'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'

type Diary = {
  id: string
  title: string
  content: string
  date: string
  created_at: string
}

export default function ListScreen() {
  const [diaries, setDiaries] = useState<Diary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  useFocusEffect(
  useCallback(() => {
    setDiaries([])
    setLoading(true)
    fetchDiaries()
  }, [])
)

  const fetchDiaries = async () => {
  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .order('created_at', { ascending: false })

  setLoading(false)
  setRefreshing(false)

  if (error) { console.error(error); return }
  setDiaries(data)
}

  const onRefresh = () => {
    setRefreshing(true)
    fetchDiaries()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1D9E75" size="large" />
      </View>
    )
  }

  if (diaries.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>まだ日記がありません</Text>
        <Text style={styles.emptyHint}>メモタブから書いてみよう！</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={diaries}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={
  <RefreshControl
    refreshing={refreshing}
    onRefresh={onRefresh}
    tintColor="#1D9E75"
    colors={['#1D9E75']}
    progressBackgroundColor="#ffffff"
  />
}
        renderItem={({ item }) => (
  <TouchableOpacity
    style={styles.card}
    onPress={() => router.push(`/diary/${item.id}`)}
  >
    <Text style={styles.date}>{item.date}　{formatTime(item.created_at)}</Text>
    <Text style={styles.content} numberOfLines={3}>
      {item.content}
    </Text>
    {item.content.length > 60 && (
      <Text style={styles.more}>続きを読む →</Text>
    )}
  </TouchableOpacity>
)}
      />
    </View>
  )
}

const formatTime = (created_at: string) => {
  const date = new Date(created_at)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
  },
  card: {
    padding: 16,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#ddd',
  },
  date: {
    fontSize: 13,
    color: '#1D9E75',
    fontWeight: '500',
    marginBottom: 8,
  },
  content: {
    fontSize: 15,
    color: '#333',
    lineHeight: 24,
  },

  more: {
  fontSize: 13,
  color: '#1D9E75',
  marginTop: 6,
  textAlign: 'right',
},
})