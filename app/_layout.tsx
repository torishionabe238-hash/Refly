import { Stack, useRouter, useSegments } from 'expo-router'
import { View, ActivityIndicator, Alert, Platform } from 'react-native'
import { useEffect, useState } from 'react'

// ウェブでは Alert.alert が動かないので window.alert/confirm で代替
if (Platform.OS === 'web') {
  (Alert as any).alert = (title: string, message?: string, buttons?: any[]) => {
    if (!buttons || buttons.length <= 1) {
      window.alert(message ? `${title}\n\n${message}` : title)
      buttons?.[0]?.onPress?.()
    } else {
      const hasDestructive = buttons.some(b => b.style === 'destructive')
      const confirmed = window.confirm(message ? `${title}\n\n${message}` : title)
      const btn = buttons.find(b =>
        confirmed ? (b.style === 'destructive' || b.style !== 'cancel') : b.style === 'cancel'
      )
      btn?.onPress?.()
    }
  }
}
import { supabase } from '../utils/supabase'
import { Session } from '@supabase/supabase-js'
import { ThemeProvider, useTheme } from '../utils/theme'
import { hasSeenOnboarding } from '../utils/onboarding'

function RootLayoutInner() {
  const { accent, card, text } = useTheme()
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    Promise.all([
      supabase.auth.getSession(),
      hasSeenOnboarding(),
    ]).then(([{ data: { session } }, seen]) => {
      setSession(session)
      setShowOnboarding(!seen && !session)
      setInitialized(true)
      setOnboardingChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!initialized) return
    const inAuthGroup = segments[0] === '(tabs)'
    if (showOnboarding && segments[0] !== 'onboarding') {
      router.replace('/onboarding')
    } else if (!session && inAuthGroup) {
      router.replace('/login')
    } else if (session && !inAuthGroup && segments[0] !== 'onboarding') {
      router.replace('/(tabs)')
    }
  }, [session, initialized, showOnboarding])

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: card }}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: card },
        headerTitleStyle: { color: text },
        headerTintColor: accent,
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="diary/[id]" options={{ title: '日記', headerBackTitle: '戻る' }} />
      <Stack.Screen name="diary/new" options={{ title: '新しい日記', headerBackTitle: '戻る', presentation: 'modal' }} />
      <Stack.Screen name="diary/edit" options={{ title: '日記を編集', headerBackTitle: '戻る' }} />
      <Stack.Screen name="episode/[id]" options={{ title: 'エピソード', headerBackTitle: '戻る' }} />

      <Stack.Screen name="import" options={{ title: '日記を取り込む', headerBackTitle: '戻る' }} />
      <Stack.Screen name="vocab" options={{ title: '単語帳', headerBackTitle: '戻る' }} />
      <Stack.Screen name="drafts" options={{ title: '下書き', headerBackTitle: '戻る' }} />
      <Stack.Screen name="tags" options={{ title: 'タグ管理', headerBackTitle: '戻る' }} />
      <Stack.Screen name="episodes" options={{ title: 'エピソード', headerBackTitle: '戻る' }} />
      <Stack.Screen name="account" options={{ title: 'アカウント', headerBackTitle: '戻る' }} />
      <Stack.Screen name="draft/[id]" options={{ title: '下書きを編集', headerBackTitle: '戻る' }} />
      <Stack.Screen name="recommend" options={{ title: '話のタネを見つける', headerBackTitle: '戻る' }} />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  )
}
