import * as FileSystem from 'expo-file-system/legacy'
import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react'

const PREFS_FILE = `${FileSystem.documentDirectory}theme_prefs.json`

async function readPrefs(): Promise<Record<string, string>> {
  try {
    const info = await FileSystem.getInfoAsync(PREFS_FILE)
    if (!info.exists) return {}
    const text = await FileSystem.readAsStringAsync(PREFS_FILE)
    return JSON.parse(text)
  } catch {
    return {}
  }
}

async function writePref(key: string, value: string) {
  try {
    const prefs = await readPrefs()
    prefs[key] = value
    await FileSystem.writeAsStringAsync(PREFS_FILE, JSON.stringify(prefs))
  } catch {}
}

export type ThemeColorPack = {
  id: string
  label: string
  accent: string
  accentBg: string
  accentBgDark: string
  accentBorder: string
  accentLight: string
  gradientEnd: string
}

export const THEME_COLORS: ThemeColorPack[] = [
  { id: 'sage',      label: 'セージ',       accent: '#6B9080', accentBg: '#F0F5F3', accentBgDark: '#1C2925', accentBorder: '#BACED4', accentLight: '#9EC0B8', gradientEnd: '#4158D0' },
  { id: 'coral',     label: 'コーラル',     accent: '#FF6B6B', accentBg: '#FFF1F1', accentBgDark: '#2E1515', accentBorder: '#FFBDBD', accentLight: '#FF9696', gradientEnd: '#C850C0' },
  { id: 'mocha',     label: 'モカ',         accent: '#A1887F', accentBg: '#F7F3F2', accentBgDark: '#2A201E', accentBorder: '#D8CBC7', accentLight: '#C0ADA9', gradientEnd: '#6366F1' },
  { id: 'lavender',  label: 'ラベンダー',   accent: '#9B8AC4', accentBg: '#F3F0FA', accentBgDark: '#1E1928', accentBorder: '#CFC4E8', accentLight: '#B9ACD6', gradientEnd: '#06B6D4' },
  { id: 'terracotta',label: 'テラコッタ',   accent: '#C1694F', accentBg: '#FBF0ED', accentBgDark: '#2B1208', accentBorder: '#E4B5A8', accentLight: '#D4907E', gradientEnd: '#7C3AED' },
  { id: 'slate',     label: 'スレート',     accent: '#6B7FA3', accentBg: '#F0F2F7', accentBgDark: '#151A25', accentBorder: '#BCC4D8', accentLight: '#8E9DC0', gradientEnd: '#00BFA5' },
]

export type Theme = {
  accent: string
  accentBg: string
  accentBorder: string
  accentLight: string
  gradientEnd: string
  dark: boolean
  bg: string
  card: string
  text: string
  sub: string
  border: string
  inputBg: string
  colorId: string
  setColorId: (id: string) => void
  toggleDark: () => void
}

const ThemeContext = createContext<Theme>({
  accent: '#6B9080', accentBg: '#F0F5F3', accentBorder: '#BACED4', accentLight: '#9EC0B8', gradientEnd: '#4158D0',
  dark: false, bg: '#f5f5f5', card: '#fff', text: '#333', sub: '#aaa', border: '#eee', inputBg: '#fafafa',
  colorId: 'sage', setColorId: () => {}, toggleDark: () => {},
})

export const useTheme = () => useContext(ThemeContext)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorId, setColorIdState] = useState('sage')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    readPrefs().then(prefs => {
      const c = prefs['theme_color']
      const d = prefs['theme_dark']
      if (c && THEME_COLORS.some(t => t.id === c)) setColorIdState(c)
      if (d) setDark(d === 'true')
    })
  }, [])

  const setColorId = useCallback((id: string) => {
    setColorIdState(id)
    writePref('theme_color', id)
  }, [])

  const toggleDark = useCallback(() => {
    setDark(prev => {
      const next = !prev
      writePref('theme_dark', String(next))
      return next
    })
  }, [])

  const value = useMemo((): Theme => {
    const pack = THEME_COLORS.find(t => t.id === colorId) ?? THEME_COLORS[0]
    return {
      accent: pack.accent,
      accentBg: dark ? pack.accentBgDark : pack.accentBg,
      accentBorder: pack.accentBorder,
      accentLight: pack.accentLight,
      gradientEnd: pack.gradientEnd,
      dark,
      bg: dark ? '#111111' : '#f5f5f5',
      card: dark ? '#1C1C1E' : '#fff',
      text: dark ? '#F0F0F0' : '#333',
      sub: dark ? '#888' : '#aaa',
      border: dark ? '#2C2C2E' : '#eee',
      inputBg: dark ? '#2C2C2E' : '#fafafa',
      colorId,
      setColorId,
      toggleDark,
    }
  }, [colorId, dark, setColorId, toggleDark])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
