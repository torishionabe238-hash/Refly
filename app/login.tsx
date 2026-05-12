import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { useState, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '../utils/supabase'
import { useTheme, Theme } from '../utils/theme'

export default function LoginScreen() {
  const theme = useTheme()
  const { accent } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const router = useRouter()

  const login = async () => {
    if (!email || !password) {
      Alert.alert('エラー', 'メールアドレスとパスワードを入力してください')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      Alert.alert('エラー', 'メールアドレスまたはパスワードが間違っています')
    } else {
      router.replace('/(tabs)')
    }
  }

  const loginAsGuest = async () => {
    setGuestLoading(true)
    const { error } = await supabase.auth.signInAnonymously()
    setGuestLoading(false)
    if (error) {
      Alert.alert('エラー', 'ゲストログインに失敗しました')
    } else {
      router.replace('/(tabs)')
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
          <Text style={styles.subtitle}>書くだけで、話がうまくなる。</Text>
        </View>

        {/* BlurView は overflow:hidden で角丸が効かないので wrapper で影をつける */}
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
              placeholder="パスワード"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={login}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'ログイン中...' : 'ログイン'}
              </Text>
            </TouchableOpacity>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>または</Text>
              <View style={styles.dividerLine} />
            </View>
            <TouchableOpacity
              style={[styles.guestButton, guestLoading && styles.buttonDisabled]}
              onPress={loginAsGuest}
              disabled={guestLoading}
            >
              <Text style={styles.guestButtonText}>
                {guestLoading ? '準備中...' : 'ゲストではじめる'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.registerLinkText}>
                アカウントをお持ちでない方はこちら
              </Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    bg: {
      flex: 1,
    },
    container: {
      flex: 1,
      paddingHorizontal: 28,
      justifyContent: 'center',
      paddingTop: 20,
    },
    titleArea: {
      alignItems: 'center',
      marginBottom: 36,
    },
    title: {
      fontSize: 80,
      fontWeight: '800',
      color: t.accent,
      letterSpacing: 4,
    },
    subtitle: {
      fontSize: 15,
      color: t.accentLight,
      letterSpacing: 1.5,
      marginTop: 6,
    },
    cardWrapper: {
      borderRadius: 24,
    },
    card: {
      borderRadius: 24,
      padding: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.65)',
    },
    input: {
      backgroundColor: 'rgba(255,255,255,0.6)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.8)',
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: '#333',
      marginBottom: 12,
    },
    button: {
      backgroundColor: t.accent,
      padding: 16,
      borderRadius: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      backgroundColor: '#aaa',
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    dividerRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20,
    },
    dividerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.5)' },
    dividerText: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
    guestButton: {
      backgroundColor: 'rgba(255,255,255,0.85)',
      padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 12,
    },
    guestButtonText: {
      color: t.accent, fontSize: 16, fontWeight: '700', letterSpacing: 0.5,
    },
    registerLink: {
      marginTop: 20,
      alignItems: 'center',
    },
    registerLinkText: {
      fontSize: 14,
      color: t.accent,
    },
  })
}
