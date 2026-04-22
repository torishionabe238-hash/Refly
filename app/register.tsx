import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '../utils/supabase'

export default function RegisterScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const register = async () => {
    if (!email || !password || !passwordConfirm) {
      Alert.alert('エラー', 'すべての項目を入力してください')
      return
    }

    if (password !== passwordConfirm) {
      Alert.alert('エラー', 'パスワードが一致しません')
      return
    }

    if (password.length < 6) {
      Alert.alert('エラー', 'パスワードは6文字以上で入力してください')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      Alert.alert('エラー', '登録に失敗しました')
      console.error(error)
    } else {
      Alert.alert('登録完了', 'アカウントを作成しました！', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ])
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Refly</Text>
        <Text style={styles.subtitle}>アカウントを作成する</Text>

        <TextInput
          style={styles.input}
          placeholder="メールアドレス"
          placeholderTextColor="#bbb"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="パスワード（6文字以上）"
          placeholderTextColor="#bbb"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="パスワード（確認）"
          placeholderTextColor="#bbb"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={register}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? '登録中...' : 'アカウント作成'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.back()}
        >
          <Text style={styles.loginLinkText}>
            すでにアカウントをお持ちの方はこちら
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    color: '#1D9E75',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 48,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#fafafa',
    borderWidth: 0.5,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1D9E75',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
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
  loginLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#1D9E75',
  },
})