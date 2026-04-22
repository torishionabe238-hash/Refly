import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { useNavigation } from 'expo-router'

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

export default function DiaryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [diary, setDiary] = useState<Diary | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const navigation = useNavigation()

  useEffect(() => {
    fetchDiary()
  }, [])

  useEffect(() => {
  navigation.setOptions({
    headerRight: () => (
      <TouchableOpacity
        onPress={deleteDiary}
        disabled={deleting}
        style={{
          backgroundColor: deleting ? '#eee' : '#FFF0F0',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#E24B4A',
        }}
      >
        <Text style={{
          fontSize: 13,
          color: deleting ? '#aaa' : '#E24B4A',
          fontWeight: '600',
        }}>
          {deleting ? '削除中...' : '削除'}
        </Text>
      </TouchableOpacity>
    )
  })
}, [deleting])

  const fetchDiary = async () => {
  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  setLoading(false)
  if (error) { console.error(error); return }
  if (!data) { router.back(); return }
  setDiary(data)
}

  const deleteDiary = async () => {
    Alert.alert(
      '日記を削除',
      'この日記を削除しますか？この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            const { error } = await supabase
              .from('diaries')
              .delete()
              .eq('id', id)

            setDeleting(false)

            if (error) {
              Alert.alert('エラー', '削除に失敗しました')
              console.error(error)
            } else {
              router.back()
            }
          }
        }
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1D9E75" size="large" />
      </View>
    )
  }

  if (!diary) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>日記が見つかりませんでした</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Text style={styles.date}>{diary.date}　{formatTime(diary.created_at)}</Text>
    <Text style={styles.body}>{diary.content}</Text>
  </ScrollView>

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
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
  },
  date: {
    fontSize: 14,
    color: '#1D9E75',
    fontWeight: '500',
    marginBottom: 16,
  },
  body: {
    fontSize: 17,
    color: '#333',
    lineHeight: 28,
  },
  deleteButton: {
    margin: 24,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E24B4A',
    marginBottom: 48,
  },
  deleteButtonDisabled: {
    borderColor: '#aaa',
  },
  deleteButtonText: {
    fontSize: 15,
    color: '#E24B4A',
    fontWeight: '500',
  },
})