import React from 'react'
import { Text, View, TextStyle } from 'react-native'

// Supported notation:
//   **text**        → bold
//   *text*          → italic
//   # text          → H1 (line-level)
//   ## text         → H2 (line-level)
//   {red}text{/}    → colored text  (colors: red, blue, green, orange, purple)

const COLOR_MAP: Record<string, string> = {
  red: '#E24B4A',
  blue: '#3B82F6',
  green: '#1D9E75',
  orange: '#F97316',
  purple: '#8B5CF6',
}

interface Span {
  text: string
  bold?: boolean
  italic?: boolean
  color?: string
}

const parseInline = (raw: string): Span[] => {
  const spans: Span[] = []
  // tokenize: **...** , *...* , {color}...{/}
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\{(\w+)\}(.+?)\{\/\}/gs
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) spans.push({ text: raw.slice(last, m.index) })
    if (m[1] !== undefined) spans.push({ text: m[1], bold: true })
    else if (m[2] !== undefined) spans.push({ text: m[2], italic: true })
    else if (m[3] !== undefined) spans.push({ text: m[4], color: COLOR_MAP[m[3]] ?? m[3] })
    last = re.lastIndex
  }
  if (last < raw.length) spans.push({ text: raw.slice(last) })
  return spans
}

const InlineSpans = ({ spans, base }: { spans: Span[]; base: TextStyle }) =>
  <>
    {spans.map((s, i) => (
      <Text
        key={i}
        style={[
          base,
          s.bold && { fontWeight: '700' },
          s.italic && { fontStyle: 'italic' },
          s.color && { color: s.color },
        ]}
      >
        {s.text}
      </Text>
    ))}
  </>

interface Props {
  content: string
  baseStyle?: TextStyle
  lineHeight?: number
}

export default function FormattedText({ content, baseStyle, lineHeight = 28 }: Props) {
  const base: TextStyle = { fontSize: 17, color: '#333', lineHeight, ...baseStyle }
  const lines = content.split('\n')

  return (
    <View>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          const spans = parseInline(line.slice(2))
          return (
            <Text key={i} style={{ fontSize: 24, fontWeight: '700', color: '#1a1a1a', lineHeight: 34, marginBottom: 4 }}>
              <InlineSpans spans={spans} base={{ fontSize: 24, fontWeight: '700', color: '#1a1a1a' }} />
            </Text>
          )
        }
        if (line.startsWith('## ')) {
          const spans = parseInline(line.slice(3))
          return (
            <Text key={i} style={{ fontSize: 20, fontWeight: '700', color: '#1a1a1a', lineHeight: 30, marginBottom: 2 }}>
              <InlineSpans spans={spans} base={{ fontSize: 20, fontWeight: '700', color: '#1a1a1a' }} />
            </Text>
          )
        }
        const spans = parseInline(line)
        return (
          <Text key={i} style={base}>
            {line === '' ? '\n' : <InlineSpans spans={spans} base={base} />}
          </Text>
        )
      })}
    </View>
  )
}

export const stripFormatting = (content: string): string =>
  content
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/^#{1,2} /gm, '')
    .replace(/\{(\w+)\}(.+?)\{\/\}/gs, '$2')
    .trim()
