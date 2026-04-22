import { Tabs } from 'expo-router'

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="calendar" options={{ title: 'カレンダー' }} />
      <Tabs.Screen name="index" options={{ title: '日記' }} />
      <Tabs.Screen name="list" options={{ title: '一覧' }} />
      <Tabs.Screen name="settings" options={{ title: '設定' }} />
    </Tabs>
  )
}