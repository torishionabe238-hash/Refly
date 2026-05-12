import { useEffect, useRef, useState } from 'react'
import { Animated, Text, View, StyleSheet } from 'react-native'
import { useTheme } from '../utils/theme'

type Props = {
  steps: string[]
  intervalMs?: number
}

export default function ThinkingIndicator({ steps, intervalMs = 1800 }: Props) {
  const { accent, accentBg, sub } = useTheme()
  const [stepIndex, setStepIndex] = useState(0)
  const opacity = useRef(new Animated.Value(1)).current
  const dot1 = useRef(new Animated.Value(0.3)).current
  const dot2 = useRef(new Animated.Value(0.3)).current
  const dot3 = useRef(new Animated.Value(0.3)).current

  // ドットのウェーブアニメーション
  useEffect(() => {
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay(800 - delay),
        ])
      )
    const a1 = pulse(dot1, 0)
    const a2 = pulse(dot2, 200)
    const a3 = pulse(dot3, 400)
    a1.start(); a2.start(); a3.start()
    return () => { a1.stop(); a2.stop(); a3.stop() }
  }, [])

  // ステップのフェード切り替え（最後で止まる）
  useEffect(() => {
    setStepIndex(0)
    opacity.setValue(1)
    let current = 0
    const next = () => {
      if (current >= steps.length - 1) return
      setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
          current += 1
          setStepIndex(current)
          Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start()
          next()
        })
      }, intervalMs)
    }
    next()
  }, [steps, intervalMs])

  return (
    <View style={[styles.container, { backgroundColor: accentBg }]}>
      <View style={styles.dots}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[styles.dot, { backgroundColor: accent, opacity: dot }]} />
        ))}
      </View>
      <Animated.Text style={[styles.step, { color: sub, opacity }]}>
        {steps[stepIndex]}
      </Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  step: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
})
