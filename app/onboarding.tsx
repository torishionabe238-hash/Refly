import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, ImageBackground } from 'react-native'
import { useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { markOnboardingDone } from '../utils/onboarding'
import { useTheme } from '../utils/theme'

const SLIDES = [
  {
    icon: 'create-outline' as const,
    title: '日記を書くだけでOK',
    desc: '今日あったことをそのまま書くだけ。\n難しく考えなくて大丈夫です。',
  },
  {
    icon: 'mic-outline' as const,
    title: 'AIがエピソードに変換',
    desc: '書いた日記をAIが\n会話で使えるエピソードトークに\n自動で仕上げます。',
  },
  {
    icon: 'bulb-outline' as const,
    title: '語彙力・表現力が上がる',
    desc: '日記の内容に合った\n「スマートに見える言葉」を\nAIが毎回提案します。',
  },
  {
    icon: 'rocket-outline' as const,
    title: 'さあ、はじめよう',
    desc: 'まずはゲストで試してみよう。\n後からアカウント登録もできます。',
  },
]

export default function OnboardingScreen() {
  const { accent, gradientEnd } = useTheme()
  const { width } = useWindowDimensions()
  const router = useRouter()
  const scrollRef = useRef<ScrollView>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const isLast = currentIndex === SLIDES.length - 1

  const goNext = () => {
    if (isLast) {
      finish()
    } else {
      const next = currentIndex + 1
      scrollRef.current?.scrollTo({ x: width * next, animated: true })
      setCurrentIndex(next)
    }
  }

  const finish = async () => {
    await markOnboardingDone()
    router.replace('/login')
  }

  return (
    <ImageBackground source={require('../assets/images/login-bg.png')} style={styles.bg} resizeMode="cover">
      <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.4)']} style={StyleSheet.absoluteFill} />

      {/* スキップボタン */}
      {!isLast && (
        <TouchableOpacity style={styles.skip} onPress={finish}>
          <Text style={styles.skipText}>スキップ</Text>
        </TouchableOpacity>
      )}

      {/* スライド */}
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <LinearGradient
              colors={[accent, gradientEnd]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.iconWrap}
            >
              <Ionicons name={slide.icon} size={40} color="#fff" />
            </LinearGradient>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.desc}>{slide.desc}</Text>
          </View>
        ))}
      </ScrollView>

      {/* ドットインジケーター */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* ボタン */}
      <View style={styles.btnArea}>
        <TouchableOpacity style={styles.btn} onPress={goNext}>
          <LinearGradient
            colors={[accent, gradientEnd]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.btnGradient}
          >
            <Text style={styles.btnText}>{isLast ? 'はじめる' : '次へ'}</Text>
            <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  skip: { position: 'absolute', top: 60, right: 24, zIndex: 10 },
  skipText: { color: 'rgba(255,255,255,0.75)', fontSize: 15 },
  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 20,
  },
  iconWrap: {
    width: 96, height: 96, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 26, fontWeight: '800', color: '#fff',
    textAlign: 'center', letterSpacing: 0.5,
  },
  desc: {
    fontSize: 16, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', lineHeight: 26,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 22, backgroundColor: '#fff',
  },
  btnArea: { paddingHorizontal: 32, paddingBottom: 52 },
  btn: { borderRadius: 18, overflow: 'hidden' },
  btnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 18,
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
})
