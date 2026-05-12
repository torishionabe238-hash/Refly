import { Tabs, useRouter } from 'expo-router'
import { TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import MaskedView from '@react-native-masked-view/masked-view'
import { useTheme } from '../../utils/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  calendar: { active: 'calendar',  inactive: 'calendar-outline' },
  index:    { active: 'create',    inactive: 'create-outline'   },
  list:     { active: 'albums',    inactive: 'albums-outline'   },
  settings: { active: 'person',    inactive: 'person-outline'   },
}

export default function TabLayout() {
  const { accent, gradientEnd, card, text, sub, border } = useTheme()
  const router = useRouter()

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: card },
        headerTitleStyle: { color: text },
        headerTintColor: accent,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: sub,
        tabBarStyle: {
          backgroundColor: card,
          borderTopWidth: 0.5,
          borderTopColor: border,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarItemStyle: {
          maxWidth: 120,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icon = ICONS[route.name]
          return <Ionicons name={focused ? icon.active : icon.inactive} size={20} color={color} />
        },
      })}
    >
      <Tabs.Screen name="calendar" options={{ title: 'カレンダー' }} />
      <Tabs.Screen name="index"    options={{ title: '日記' }} />
      <Tabs.Screen name="list" options={{
        title: '一覧',
        headerRight: () => (
          <TouchableOpacity onPress={() => router.push('/recommend')} style={{ marginRight: 16 }} activeOpacity={0.7}>
            <MaskedView maskElement={<Ionicons name="leaf" size={24} color="#000" />}>
              <LinearGradient
                colors={[accent, gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 24, height: 24 }}
              />
            </MaskedView>
          </TouchableOpacity>
        ),
      }} />

      <Tabs.Screen name="settings" options={{
        title: 'マイページ',
        headerRight: () => (
          <TouchableOpacity onPress={() => router.push('/account')} style={{ marginRight: 16 }}>
            <Ionicons name="settings-outline" size={22} color={accent} />
          </TouchableOpacity>
        ),
      }} />
    </Tabs>
  )
}
