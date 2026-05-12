import { View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

type Props = {
  colors: readonly [string, string, ...string[]]
  start?: { x: number; y: number }
  end?: { x: number; y: number }
  style?: any
  children?: React.ReactNode
}

export default function AuroraGradient({
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  style,
  children,
}: Props) {
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      <LinearGradient
        colors={colors}
        start={start}
        end={end}
        style={StyleSheet.absoluteFillObject}
      />
      {children}
    </View>
  )
}
