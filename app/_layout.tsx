import { Stack, useRouter, useSegments } from 'expo-router'
import { TouchableOpacity, Text } from 'react-native'
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setInitialized(true)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  useEffect(() => {
    if (!initialized) return

    const inAuthGroup = segments[0] === '(tabs)'

    // 開発中は認証スキップ
  // if (!session && inAuthGroup) {
  //   router.replace('/login')
  // } else if (session && !inAuthGroup) {
  //   router.replace('/(tabs)')
  // }
  }, [session, initialized])

  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="diary/[id]"
        options={{
          title: '日記',
          headerTintColor: '#1D9E75',
          headerBackTitle: '戻る',
        }}
      />
      <Stack.Screen
        name="diary/new"
        options={{
          title: '新しい日記',
          headerTintColor: '#1D9E75',
          headerBackTitle: '戻る',
          presentation: 'modal',
        }}
      />
    </Stack>
  )
}