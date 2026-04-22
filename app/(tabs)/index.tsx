import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native'
import { useState } from 'react'
import { supabase } from '../../utils/supabase'
import * as ImagePicker from 'expo-image-picker'

export default function HomeScreen() {
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('エラー', '写真へのアクセスを許可してください')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    })

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri)
      setPhotos(prev => [...prev, ...uris])
    }
  }

  const uploadPhotos = async (userId: string): Promise<string[]> => {
    const urls: string[] = []

    for (const uri of photos) {
      const fileName = `${userId}/${Date.now()}.jpg`
      const response = await fetch(uri)
      const blob = await response.blob()

      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = reject
        reader.readAsArrayBuffer(blob)
      })

      const { error } = await supabase.storage
        .from('diary-photos')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' })

      if (!error) {
        const { data } = supabase.storage
          .from('diary-photos')
          .getPublicUrl(fileName)
        urls.push(data.publicUrl)
      }
    }

    return urls
  }

  const saveDiary = async () => {
    if (memo.trim() === '') {
      Alert.alert('エラー', '何か書いてから保存してください')
      return
    }

     console.log('メモ内容:', memo)
  console.log('写真枚数:', photos.length)
  setSaving(true)
  console.log('saving開始')
  

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    console.log('user id:', user?.id)

    const photoUrls = photos.length > 0 ? await uploadPhotos(user.id) : []

    const { error } = await supabase
      .from('diaries')
      .insert({
        title: today,
        content: memo,
        date: new Date().toISOString().split('T')[0],
        user_id: user.id,
        photos: photoUrls,
      })

    setSaving(false)

    if (error) {
      Alert.alert('エラー', '保存に失敗しました')
      console.error(error)
    } else {
      setMemo('')
      setPhotos([])
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.date}>{today}</Text>
        <TextInput
          style={styles.input}
          placeholder="今日のことを書いてみよう..."
          placeholderTextColor="#bbb"
          multiline
          value={memo}
          onChangeText={setMemo}
        />

        {photos.length > 0 && (
          <ScrollView horizontal style={styles.photoList}>
            {photos.map((uri, index) => (
              <View key={index} style={styles.photoWrapper}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.photoDelete}
                  onPress={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                >
                  <Text style={styles.photoDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
          <Text style={styles.photoButtonText}>📷　写真を追加</Text>
        </TouchableOpacity>
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
    fontSize: 18,
    color: '#1D9E75',
    fontWeight: '600',
    marginBottom: 20,
    marginTop: 8,
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F8F3',
    paddingBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: 28,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 200,
  },
  photoList: {
    marginVertical: 12,
  },
  photoWrapper: {
    marginRight: 8,
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  photoDelete: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 99,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDeleteText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  photoButton: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#1D9E75',
    alignItems: 'center',
    marginVertical: 12,
  },
  photoButtonText: {
    fontSize: 14,
    color: '#1D9E75',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#1D9E75',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
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