import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../utils/supabase'

export default function NewDiary() {
  const { date } = useLocalSearchParams<{ date: string }>()
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const saveDiary = async () => {
  if (content.trim() === '') {
    Alert.alert('エラー', '何か書いてから保存してください')
    return
  }

  setSaving(true)

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('diaries')
    .insert({
      title: date,
      content,
      date,
      user_id: user?.id,
    })

  setSaving(false)

  if (error) {
    Alert.alert('エラー', '保存に失敗しました')
    console.error(error)
  } else {
    router.back()
  }
}

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.date}>{date}</Text>
        <TextInput
          style={styles.input}
          placeholder="この日のことを書いてみよう..."
          placeholderTextColor="#bbb"
          multiline
          value={content}
          onChangeText={setContent}
          autoFocus
        />
      </ScrollView>

      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={saveDiary}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? '保存中...' : '保存する'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  inner: {
    flexGrow: 1,
  },
  date: {
    fontSize: 22,
    fontWeight: '500',
    color: '#1D9E75',
    marginBottom: 20,
    marginTop: 8,
  },
  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: 28,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 300,
  },
  button: {
    backgroundColor: '#1D9E75',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 48,　// ← ここを増やす
    shadowColor: '#1D9E75',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#aaa',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
})