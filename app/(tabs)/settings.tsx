import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../utils/supabase'

export default function SettingsScreen() {
  const router = useRouter()

  const logout = async () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut()
            if (error) {
              Alert.alert('エラー', 'ログアウトに失敗しました')
            } else {
              router.replace('/login')
            }
          }
        }
      ]
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アカウント</Text>

        <TouchableOpacity style={styles.item} onPress={logout}>
          <Text style={styles.itemTextDanger}>ログアウト</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginTop: 32,
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 13,
    color: '#aaa',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    letterSpacing: 0.5,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderColor: '#eee',
  },
  itemTextDanger: {
    fontSize: 16,
    color: '#E24B4A',
  },
})