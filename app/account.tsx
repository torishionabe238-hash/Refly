import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Switch, Platform } from 'react-native'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '../utils/supabase'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, THEME_COLORS, Theme } from '../utils/theme'
import DateTimePicker from '@react-native-community/datetimepicker'
import { getNotificationPrefs, saveNotificationPrefs, requestPermission, scheduleReminder, cancelReminder } from '../utils/notifications'

export default function AccountScreen() {
  const theme = useTheme()
  const { accent, dark, card, text, sub, border, inputBg, bg, setColorId, colorId, toggleDark } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])
  const router = useRouter()

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [isGuest, setIsGuest] = useState(false)
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderTime, setReminderTime] = useState(new Date(new Date().setHours(21, 0, 0, 0)))
  const [showTimePicker, setShowTimePicker] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.email) setEmail(session.user.email)
      setIsGuest(session?.user.is_anonymous ?? false)
    })
    getNotificationPrefs().then(prefs => {
      setReminderEnabled(prefs.enabled)
      const d = new Date()
      d.setHours(prefs.hour, prefs.minute, 0, 0)
      setReminderTime(d)
    })
  }, [])

  const toggleReminder = async (value: boolean) => {
    if (value) {
      const granted = await requestPermission()
      if (!granted) {
        Alert.alert('通知を許可してください', '設定アプリから Refly の通知を有効にしてください')
        return
      }
      await scheduleReminder(reminderTime.getHours(), reminderTime.getMinutes())
    } else {
      await cancelReminder()
    }
    setReminderEnabled(value)
    await saveNotificationPrefs({ enabled: value, hour: reminderTime.getHours(), minute: reminderTime.getMinutes() })
  }

  const onTimeChange = async (_: any, selected?: Date) => {
    setShowTimePicker(Platform.OS === 'ios')
    if (!selected) return
    setReminderTime(selected)
    if (reminderEnabled) {
      await scheduleReminder(selected.getHours(), selected.getMinutes())
    }
    await saveNotificationPrefs({ enabled: reminderEnabled, hour: selected.getHours(), minute: selected.getMinutes() })
  }

  const formatTime = (date: Date) =>
    `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`

  const changePassword = async () => {
    if (!newPassword || !confirmPassword) { Alert.alert('エラー', 'すべての項目を入力してください'); return }
    if (newPassword !== confirmPassword) { Alert.alert('エラー', 'パスワードが一致しません'); return }
    if (newPassword.length < 6) { Alert.alert('エラー', 'パスワードは6文字以上で入力してください'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) {
      Alert.alert('エラー', 'パスワードの変更に失敗しました')
    } else {
      Alert.alert('完了', 'パスワードを変更しました')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    }
  }

  const logout = () => {
    Alert.alert('ログアウト', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut()
          if (error) Alert.alert('エラー', 'ログアウトに失敗しました')
          else router.replace('/login')
        },
      },
    ])
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>テーマカラー</Text>
        <View style={styles.colorRow}>
          {THEME_COLORS.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.swatch, { backgroundColor: c.accent }, colorId === c.id && styles.swatchActive]}
              onPress={() => setColorId(c.id)}
            >
              {colorId === c.id && <Ionicons name="checkmark" size={18} color="#fff" />}
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.colorLabel}>
          {THEME_COLORS.find(c => c.id === colorId)?.label ?? ''}
        </Text>
        <View style={styles.item}>
          <View style={styles.itemLeft}>
            <Ionicons name={dark ? 'moon' : 'sunny-outline'} size={22} color={sub} />
            <Text style={styles.itemText}>ダークモード</Text>
          </View>
          <Switch value={dark} onValueChange={toggleDark} trackColor={{ false: border, true: accent }} thumbColor="#fff" />
        </View>
      </View>

      {/* リマインダー */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>リマインダー</Text>
        <View style={styles.item}>
          <View style={styles.itemLeft}>
            <Ionicons name="notifications-outline" size={22} color={sub} />
            <View>
              <Text style={styles.itemText}>毎日の通知</Text>
              <Text style={styles.itemSub}>日記を書くリマインダー</Text>
            </View>
          </View>
          <Switch value={reminderEnabled} onValueChange={toggleReminder} trackColor={{ false: border, true: accent }} thumbColor="#fff" />
        </View>
        {reminderEnabled && (
          <TouchableOpacity style={styles.item} onPress={() => setShowTimePicker(true)}>
            <View style={styles.itemLeft}>
              <Ionicons name="time-outline" size={22} color={sub} />
              <Text style={styles.itemText}>通知時刻</Text>
            </View>
            <Text style={[styles.itemValue, { color: accent, fontWeight: '600' }]}>{formatTime(reminderTime)}</Text>
          </TouchableOpacity>
        )}
        {showTimePicker && (
          <DateTimePicker
            value={reminderTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
            locale="ja"
          />
        )}
      </View>

      {!isGuest && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント情報</Text>
          <View style={styles.item}>
            <View style={styles.itemLeft}>
              <Ionicons name="mail-outline" size={22} color={sub} />
              <View>
                <Text style={styles.itemLabel}>メールアドレス</Text>
                <Text style={styles.itemValue}>{email}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.item} onPress={() => setShowPasswordForm(v => !v)}>
            <View style={styles.itemLeft}>
              <Ionicons name="lock-closed-outline" size={22} color={sub} />
              <Text style={styles.itemText}>パスワードを変更</Text>
            </View>
            <Ionicons name={showPasswordForm ? 'chevron-up' : 'chevron-down'} size={18} color={sub} />
          </TouchableOpacity>
        </View>
      )}

      {!isGuest && showPasswordForm && (
        <View style={styles.passwordForm}>
          <TextInput
            style={styles.input}
            placeholder="新しいパスワード（6文字以上）"
            placeholderTextColor={sub}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="パスワード（確認）"
            placeholderTextColor={sub}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={changePassword}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? '変更中...' : '変更する'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>データ</Text>
        <TouchableOpacity style={styles.item} onPress={() => router.push('/import')}>
          <View style={styles.itemLeft}>
            <Ionicons name="download-outline" size={22} color={sub} />
            <View>
              <Text style={styles.itemText}>日記を取り込む</Text>
              <Text style={[styles.itemLabel, { marginTop: 2 }]}>ファイルからAIが自動で登録</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={sub} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>その他</Text>
        <TouchableOpacity style={styles.item} onPress={logout}>
          <View style={styles.itemLeft}>
            <Ionicons name="log-out-outline" size={22} color="#E24B4A" />
            <Text style={styles.itemTextDanger}>ログアウト</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    section: {
      marginTop: 32, backgroundColor: t.card,
      borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: t.border,
    },
    sectionTitle: { fontSize: 13, color: t.sub, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, letterSpacing: 0.5 },
    item: {
      paddingHorizontal: 16, paddingVertical: 14,
      borderTopWidth: 0.5, borderColor: t.border,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    itemLabel: { fontSize: 12, color: t.sub },
    itemValue: { fontSize: 14, color: t.text, marginTop: 2 },
    itemSub: { fontSize: 12, color: t.sub, marginTop: 2 },
    itemText: { fontSize: 16, color: t.text },
    itemTextDanger: { fontSize: 16, color: '#E24B4A' },
    passwordForm: {
      marginTop: 1, backgroundColor: t.card, padding: 16,
      borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: t.border,
    },
    input: {
      backgroundColor: t.inputBg, borderWidth: 0.5, borderColor: t.border,
      borderRadius: 12, padding: 14, fontSize: 15, color: t.text, marginBottom: 10,
    },
    saveButton: { backgroundColor: t.accent, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
    saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    colorRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 0.5, borderColor: t.border },
    swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    swatchActive: { borderWidth: 3, borderColor: t.card },
    colorLabel: { fontSize: 12, color: t.sub, paddingHorizontal: 16, paddingBottom: 12, textAlign: 'center' },
  })
}
