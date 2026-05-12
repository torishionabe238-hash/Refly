import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, Animated, Easing, PanResponder, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../utils/theme'

type Props = {
  visible: boolean
  onClose: () => void
  title: string
  titleIcon?: React.ReactNode
  hideCloseButton?: boolean
  disableClose?: boolean
  maxHeight?: string | number
  children: React.ReactNode
}

export default function BottomSheet({
  visible, onClose, title, titleIcon,
  hideCloseButton, disableClose, maxHeight = '82%', children,
}: Props) {
  const { card, text, border, inputBg } = useTheme()
  const [mounted, setMounted] = useState(visible)
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current

  useEffect(() => {
    if (visible) {
      setMounted(true)
      Animated.timing(anim, {
        toValue: 1, duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(anim, {
        toValue: 0, duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false))
    }
  }, [visible])

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !disableClose,
    onPanResponderMove: (_, g) => {
      if (!disableClose && g.dy > 0) anim.setValue(Math.max(0, 1 - g.dy / 500))
    },
    onPanResponderRelease: (_, g) => {
      if (!disableClose && (g.dy > 80 || g.vy > 0.5)) {
        onClose()
      } else {
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 12 }).start()
      }
    },
  })).current

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] })
  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })

  if (!mounted) return null

  return (
    <Modal visible transparent animationType="none">
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: 'rgba(0,0,0,0.45)' }]}>
          {!disableClose && <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />}
        </Animated.View>
        <Animated.View style={[styles.sheet, { maxHeight, backgroundColor: card, transform: [{ translateY }] }]}>
          <View {...pan.panHandlers} style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: border }]} />
          </View>
          <View style={[styles.header, { borderBottomColor: border }]}>
            <View style={styles.titleRow}>
              {titleIcon ?? null}
              <Text style={[styles.title, { color: text }]}>{title}</Text>
            </View>
            {!hideCloseButton && (
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: inputBg }]}>
                <Ionicons name="close" size={16} color="#888" />
              </TouchableOpacity>
            )}
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 32,
  },
  handleArea: { alignItems: 'center', paddingTop: 12, paddingBottom: 6, paddingHorizontal: 40 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
})
