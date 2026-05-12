import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ImageBackground,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { useState, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '../utils/supabase'
import { useTheme, Theme } from '../utils/theme'

export default function RegisterScreen() {
  const theme = useTheme()
  const { accent } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])

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
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      Alert.alert('エラー', '登録に失敗しました')
    } else {
      Alert.alert('登録完了', 'アカウントを作成しました！', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ])
    }
  }

  return (
    <ImageBackground
      source={require('../assets/images/login-bg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.titleArea}>
          <Text style={styles.title}>Refly</Text>
          <Text style={styles.subtitle}>アカウントを作成する</Text>
        </View>

        <View style={styles.cardWrapper}>
          <BlurView intensity={65} tint="light" style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="メールアドレス"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="パスワード（6文字以上）"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <TextInput
              style={styles.input}
              placeholder="パスワード（確認）"
              placeholderTextColor="#999"
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry
              textContentType="none"
              autoCorrect={false}
              autoComplete="off"
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
            <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
              <Text style={styles.loginLinkText}>すでにアカウントをお持ちの方はこちら</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    bg: { flex: 1 },
    container: {
      flex: 1, paddingHorizontal: 28,
      justifyContent: 'center', paddingTop: 20,
    },
    titleArea: { alignItems: 'center', marginBottom: 36 },
    title: {
      fontSize: 80, fontWeight: '800', color: t.accent, letterSpacing: 4,
    },
    subtitle: {
      fontSize: 15, color: t.accentLight, letterSpacing: 1.5, marginTop: 6,
    },
    cardWrapper: { borderRadius: 24 },
    card: {
      borderRadius: 24, padding: 28, overflow: 'hidden',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)',
    },
    input: {
      backgroundColor: 'rgba(255,255,255,0.6)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)',
      borderRadius: 12, padding: 16, fontSize: 16, color: '#333', marginBottom: 12,
    },
    button: {
      backgroundColor: t.accent, padding: 16,
      borderRadius: 16, alignItems: 'center', marginTop: 8,
    },
    buttonDisabled: { backgroundColor: '#aaa' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
    loginLink: { marginTop: 20, alignItems: 'center' },
    loginLinkText: { fontSize: 14, color: t.accent },
  })
}
