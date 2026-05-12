import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native'
import { useState, useRef, useMemo } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, Theme } from '../utils/theme'

const WebView = Platform.OS === 'web'
  ? () => null
  : require('react-native-webview').default

type Props = {
  dateLabel: string
  saving: boolean
  initialContentHTML?: string
  keyboardOffset?: number
  bottomInset?: number
  disableKAV?: boolean
  tags?: string[]
  availableTags?: string[]
  onTagsChange?: (tags: string[]) => void
  onSave: (content: string, photos: string[]) => void
  onSaveDraft?: (html: string) => void
  onPickImage: () => Promise<string[]>
}

const COLORS = [
  '#E24B4A', '#F97316', '#1D9E75', '#3B82F6', '#8B5CF6',
]

function buildEditorHTML(bg: string, textColor: string, placeholder: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; background: ${bg}; height: 100%; }
#editor {
  min-height: 100vh;
  font-size: 17px;
  font-family: -apple-system, 'Helvetica Neue', sans-serif;
  line-height: 1.75;
  color: ${textColor};
  padding: 16px;
  outline: none;
  word-break: break-word;
}
#editor:empty::before {
  content: attr(data-placeholder);
  color: ${bg === '#fff' ? '#bbb' : '#666'};
  pointer-events: none;
  display: block;
}
h1 { font-size: 24px; font-weight: 700; margin: 8px 0 4px; }
h2 { font-size: 20px; font-weight: 700; margin: 6px 0 4px; }
p { margin: 0 0 4px; }
ul, ol { padding-left: 22px; margin: 4px 0; }
li { margin: 2px 0; }
</style>
</head>
<body>
<div id="editor" contenteditable="true" data-placeholder="${placeholder}"></div>
<script>
var editor = document.getElementById('editor');

function send(type, extra) {
  var msg = Object.assign({ type: type }, extra || {});
  window.ReactNativeWebView.postMessage(JSON.stringify(msg));
}

function sendState() {
  var block = document.queryCommandValue('formatBlock').toLowerCase();
  send('state', {
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'),
    h1: block === 'h1',
    h2: block === 'h2',
  });
}

function execCmd(cmd, value) {
  editor.focus();
  if (cmd === 'formatBlock') {
    var cur = document.queryCommandValue('formatBlock').toLowerCase();
    document.execCommand('formatBlock', false, (cur === value.toLowerCase()) ? 'p' : value);
  } else {
    document.execCommand(cmd, false, value || null);
  }
  sendContent();
  sendState();
}

function setContent(html) {
  editor.innerHTML = html || '';
  sendContent();
}

function sendContent() {
  send('content', { html: editor.innerHTML, empty: editor.innerText.trim() === '' });
}

editor.addEventListener('input', sendContent);
document.addEventListener('selectionchange', sendState);

// React Native WebView では1回目のタップがWebView自体に吸収されることがある
// touchend で明示的にフォーカスを当てて keyboard を確実に出す
document.addEventListener('touchend', function(e) {
  if (e.target === editor || editor.contains(e.target)) {
    editor.focus();
  }
}, true);
</script>
</body>
</html>`
}

export default function DiaryEditor({ dateLabel, saving, initialContentHTML = '', keyboardOffset = 90, bottomInset = 0, disableKAV = false, tags, availableTags, onTagsChange, onSave, onSaveDraft, onPickImage }: Props) {
  const theme = useTheme()
  const { accent, accentBg, accentBorder, card, text, sub, border, inputBg, dark } = theme
  const styles = useMemo(() => makeStyles(theme), [theme])

  const webViewRef = useRef<WebView>(null)
  const [contentHtml, setContentHtml] = useState(initialContentHTML)
  const [photos, setPhotos] = useState<string[]>([])
  const [showColors, setShowColors] = useState(false)
  const [fmt, setFmt] = useState({ bold: false, italic: false, underline: false, h1: false, h2: false })
  const [menuVisible, setMenuVisible] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [modalTags, setModalTags] = useState<string[]>([])

  const currentTags = tags ?? []

  const openTagModal = () => {
    setModalTags([...currentTags])
    setShowPlusMenu(false)
    setShowTagModal(true)
  }

  const closeTagModal = () => {
    onTagsChange?.(modalTags)
    setShowTagModal(false)
    setTagInput('')
  }

  const modalSuggestions = (availableTags ?? []).filter(t => !modalTags.includes(t))

  const addModalTag = (name?: string) => {
    const t = (name ?? tagInput).trim()
    if (!t || modalTags.includes(t)) { setTagInput(''); return }
    setModalTags(prev => [...prev, t])
    setTagInput('')
  }

  const removeModalTag = (i: number) => {
    setModalTags(prev => prev.filter((_, idx) => idx !== i))
  }

  const editorHtml = useMemo(
    () => buildEditorHTML(card, text, '今日のことを書いてみよう...'),
    [card, text]
  )

  const handlePlusPress = () => {
    setShowPlusMenu(v => !v)
    setShowColors(false)
  }

  const handleMenuPhoto = async () => {
    setShowPlusMenu(false)
    const uris = await onPickImage()
    setPhotos(prev => [...prev, ...uris])
  }

  const handleMenuTag = () => { openTagModal() }

  const onLoad = () => {
    if (initialContentHTML) {
      const escaped = JSON.stringify(initialContentHTML)
      webViewRef.current?.injectJavaScript(`setContent(${escaped}); true;`)
    }
  }

  const exec = (cmd: string, value?: string) => {
    const v = value ? JSON.stringify(value) : 'null'
    webViewRef.current?.injectJavaScript(`execCmd(${JSON.stringify(cmd)}, ${v}); true;`)
    setShowColors(false)
  }

  const onMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg.type === 'content') setContentHtml(msg.html)
      if (msg.type === 'state') setFmt({ bold: msg.bold, italic: msg.italic, underline: msg.underline, h1: msg.h1, h2: msg.h2 })
    } catch (_e) {}
  }

  const clearEditor = () => {
    webViewRef.current?.injectJavaScript(`setContent(''); true;`)
    setContentHtml('')
    setPhotos([])
  }

  const handleSaveDraftAndClear = () => {
    setMenuVisible(false)
    if (onSaveDraft) onSaveDraft(contentHtml)
    clearEditor()
  }

  const handleDiscardAndClear = () => {
    setMenuVisible(false)
    clearEditor()
  }

  const isEmpty = contentHtml.replace(/<[^>]*>/g, '').trim() === ''

  const handleSave = () => {
    onSave(contentHtml, photos)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}
      enabled={!disableKAV}
    >
      {/* 日付ヘッダー */}
      <View style={styles.dateRow}>
        <Text style={styles.dateLabel}>{dateLabel}</Text>
        {onSaveDraft && (
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(v => !v)}>
            <Ionicons name="ellipsis-vertical" size={20} color={sub} />
          </TouchableOpacity>
        )}
      </View>

      {/* 下書き/削除メニュー */}
      {menuVisible && (
        <>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          />
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={handleSaveDraftAndClear}>
              <Ionicons name="save-outline" size={18} color={accent} />
              <Text style={styles.menuItemText}>下書きを保存</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleDiscardAndClear}>
              <Ionicons name="trash-outline" size={18} color="#E24B4A" />
              <Text style={[styles.menuItemText, { color: '#E24B4A' }]}>削除する</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* エディタ */}
      {Platform.OS === 'web' ? (
        <TextInput
          style={[styles.webEditor, { color: text, backgroundColor: card }]}
          multiline
          placeholder="今日のことを書いてみよう..."
          placeholderTextColor={sub}
          value={contentHtml.replace(/<[^>]*>/g, '')}
          onChangeText={v => setContentHtml(v ? `<p>${v.replace(/\n/g, '</p><p>')}</p>` : '')}
          textAlignVertical="top"
        />
      ) : (
        <WebView
          ref={webViewRef}
          source={{ html: editorHtml }}
          style={styles.webview}
          onLoad={onLoad}
          onMessage={onMessage}
          scrollEnabled
          keyboardDisplayRequiresUserAction={false}
          showsVerticalScrollIndicator={false}
          originWhitelist={['*']}
          hideKeyboardAccessoryView
        />
      )}

      {/* 写真 */}
      {photos.length > 0 && (
        <ScrollView horizontal style={styles.photoList} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photo} />
              <View style={styles.photoCount}>
                <Text style={styles.photoCountText}>{i + 1}</Text>
              </View>
              <TouchableOpacity
                style={styles.photoDelete}
                onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
              >
                <Ionicons name="close" size={11} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* カラーパレット（ネイティブのみ） */}
      {Platform.OS !== 'web' && showColors && (
        <View style={styles.colorPalette}>
          {COLORS.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.colorSwatch, { backgroundColor: c }]}
              onPress={() => exec('foreColor', c)}
            />
          ))}
          <TouchableOpacity style={styles.colorSwatchReset} onPress={() => exec('foreColor', dark ? '#F0F0F0' : '#333333')}>
            <Text style={styles.colorResetText}>戻す</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* フォーマットツールバー（ネイティブのみ） */}
      {Platform.OS !== 'web' && <View style={styles.toolbar}>
        <TouchableOpacity style={[styles.fmtBtn, fmt.bold && styles.fmtBtnActive]} onPress={() => exec('bold')}>
          <Text style={[styles.fmtBold, fmt.bold && styles.fmtTextActive]}>B</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.italic && styles.fmtBtnActive]} onPress={() => exec('italic')}>
          <Text style={[styles.fmtItalic, fmt.italic && styles.fmtTextActive]}>I</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.underline && styles.fmtBtnActive]} onPress={() => exec('underline')}>
          <Text style={[styles.fmtUnderline, fmt.underline && styles.fmtTextActive]}>U</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.h1 && styles.fmtBtnActive]} onPress={() => exec('formatBlock', 'h1')}>
          <Text style={[styles.fmtText, fmt.h1 && styles.fmtTextActive]}>H1</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fmtBtn, fmt.h2 && styles.fmtBtnActive]} onPress={() => exec('formatBlock', 'h2')}>
          <Text style={[styles.fmtText, fmt.h2 && styles.fmtTextActive]}>H2</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fmtBtn} onPress={() => exec('insertUnorderedList')}>
          <Ionicons name="list-outline" size={18} color={sub} />
        </TouchableOpacity>
        <View style={styles.fmtDivider} />
        <TouchableOpacity style={[styles.fmtBtn, showColors && styles.fmtBtnActive]} onPress={() => setShowColors(v => !v)}>
          <View style={styles.colorDot} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.fmtBtn} onPress={() => exec('undo')}>
          <Ionicons name="arrow-undo-outline" size={17} color={sub} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fmtBtn} onPress={() => exec('redo')}>
          <Ionicons name="arrow-redo-outline" size={17} color={sub} />
        </TouchableOpacity>
      </View>}

      {/* 選択中タグ（コンパクト表示） */}
      {currentTags.length > 0 && (
        <TouchableOpacity style={[styles.tagCompactRow, { borderTopColor: border }]} onPress={openTagModal}>
          <Ionicons name="pricetag-outline" size={13} color={sub} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }} style={{ flex: 1 }}>
            {currentTags.map((tag, i) => (
              <View key={i} style={[styles.tagChip, { backgroundColor: accentBg }]}>
                <Text style={[styles.tagChipText, { color: accent }]}>#{tag}</Text>
              </View>
            ))}
          </ScrollView>
          <Ionicons name="chevron-forward" size={14} color={sub} />
        </TouchableOpacity>
      )}

      {/* タグモーダル */}
      <Modal visible={showTagModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeTagModal}>
        <View style={[styles.tagModalContainer, { backgroundColor: card }]}>
          <View style={[styles.tagModalHeader, { borderBottomColor: border }]}>
            <Text style={[styles.tagModalTitle, { color: text }]}>タグ</Text>
            <TouchableOpacity onPress={closeTagModal}>
              <Text style={[styles.tagModalDone, { color: accent }]}>完了</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
            {modalTags.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.tagModalSection, { color: sub }]}>選択中</Text>
                <View style={styles.tagWrap}>
                  {modalTags.map((tag, i) => (
                    <TouchableOpacity key={i} style={[styles.tagChip, { backgroundColor: accentBg }]} onPress={() => removeModalTag(i)}>
                      <Text style={[styles.tagChipText, { color: accent }]}>#{tag}</Text>
                      <Ionicons name="close" size={11} color={accent} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            {modalSuggestions.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.tagModalSection, { color: sub }]}>候補</Text>
                <View style={styles.tagWrap}>
                  {modalSuggestions.map((tag, i) => (
                    <TouchableOpacity key={i} style={[styles.tagSuggestion, { borderColor: accentBorder }]} onPress={() => addModalTag(tag)}>
                      <Text style={[styles.tagSuggestionText, { color: accent }]}>#{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <View style={{ gap: 8 }}>
              <Text style={[styles.tagModalSection, { color: sub }]}>新しいタグ</Text>
              <View style={[styles.tagInputRow, { backgroundColor: inputBg, borderColor: border }]}>
                <TextInput
                  style={[styles.tagModalInput, { color: text }]}
                  placeholder="タグ名を入力..."
                  placeholderTextColor={sub}
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={() => addModalTag()}
                  returnKeyType="done"
                  blurOnSubmit={false}
                />
                <TouchableOpacity onPress={() => addModalTag()} disabled={!tagInput.trim()}>
                  <Ionicons name="add-circle" size={26} color={tagInput.trim() ? accent : sub} />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* + メニュー */}
      {showPlusMenu && (
        <>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
            activeOpacity={1}
            onPress={() => setShowPlusMenu(false)}
          />
          <View style={[styles.plusMenu, { backgroundColor: card }]}>
            <TouchableOpacity style={styles.plusMenuItem} onPress={handleMenuPhoto}>
              <Ionicons name="image-outline" size={20} color={accent} />
              <Text style={[styles.plusMenuText, { color: text }]}>写真を追加</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: border }]} />
            <TouchableOpacity style={styles.plusMenuItem} onPress={handleMenuTag}>
              <Ionicons name="pricetag-outline" size={20} color={accent} />
              <Text style={[styles.plusMenuText, { color: text }]}>タグを追加</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* 保存バー */}
      <View style={[styles.bottomBar, bottomInset > 0 && { paddingBottom: bottomInset }]}>
        <TouchableOpacity style={[styles.plusButton, showPlusMenu && { backgroundColor: accentBg }]} onPress={handlePlusPress}>
          <Ionicons name={showPlusMenu ? 'close' : 'add'} size={26} color={showPlusMenu ? accent : sub} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, (saving || isEmpty) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || isEmpty}
        >
          <Text style={styles.saveButtonText}>{saving ? '保存中...' : '保存する'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.card },
    dateRow: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: 16, marginTop: 16,
      paddingBottom: 14, paddingLeft: 8,
      borderBottomWidth: 1, borderBottomColor: t.accentBorder,
    },
    dateLabel: {
      flex: 1, fontSize: 18, color: t.accent, fontWeight: '600', letterSpacing: 0.5,
    },
    menuButton: { padding: 8 },
    menuCard: {
      position: 'absolute', top: 58, right: 16, zIndex: 20,
      backgroundColor: t.card, borderRadius: 14,
      width: 190, overflow: 'hidden',
      borderWidth: 0.5, borderColor: t.border,
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    menuItemText: { fontSize: 15, fontWeight: '600', color: t.text },
    menuDivider: { height: 0.5, backgroundColor: t.border, marginHorizontal: 14 },
    webview: { flex: 1, backgroundColor: t.card },
    webEditor: { flex: 1, fontSize: 17, lineHeight: 28, padding: 16, textAlignVertical: 'top' },
    photoList: { maxHeight: 130, flexShrink: 0 },
    photoWrapper: { position: 'relative' },
    photo: { width: 100, height: 100, borderRadius: 12 },
    photoCount: {
      position: 'absolute', bottom: 6, left: 6,
      backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 99,
      width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    },
    photoCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    photoDelete: {
      position: 'absolute', top: 5, right: 5,
      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 99,
      width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
    },

    colorPalette: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 10,
      backgroundColor: t.inputBg, borderTopWidth: 0.5, borderTopColor: t.border,
    },
    colorSwatch: {
      width: 30, height: 30, borderRadius: 15,
    },
    colorSwatchReset: {
      paddingHorizontal: 10, paddingVertical: 6,
      backgroundColor: t.card, borderRadius: 8, borderWidth: 1, borderColor: t.border,
    },
    colorResetText: { fontSize: 12, color: t.sub },

    toolbar: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.inputBg,
      borderTopWidth: 0.5, borderTopColor: t.border,
      paddingHorizontal: 6, paddingVertical: 4, gap: 2,
    },
    fmtBtn: {
      width: 36, height: 36, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    fmtBtnActive: { backgroundColor: t.accentBg },
    fmtTextActive: { color: t.accent },
    fmtBold: { fontSize: 16, fontWeight: '800', color: t.text },
    fmtItalic: { fontSize: 16, fontStyle: 'italic', fontWeight: '600', color: t.text },
    fmtUnderline: { fontSize: 16, textDecorationLine: 'underline', fontWeight: '600', color: t.text },
    fmtText: { fontSize: 13, fontWeight: '700', color: t.text },
    fmtDivider: { width: 1, height: 20, backgroundColor: t.border, marginHorizontal: 2 },
    colorDot: {
      width: 18, height: 18, borderRadius: 9,
      backgroundColor: '#E24B4A',
    },

    tagCompactRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingVertical: 8,
      backgroundColor: t.inputBg, borderTopWidth: 0.5,
    },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tagSuggestion: {
      borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5,
      borderWidth: 1,
    },
    tagSuggestionText: { fontSize: 13 },
    tagChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5,
    },
    tagChipText: { fontSize: 13, fontWeight: '600' },
    tagModalContainer: { flex: 1 },
    tagModalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: 0.5,
    },
    tagModalTitle: { fontSize: 17, fontWeight: '600' },
    tagModalDone: { fontSize: 16, fontWeight: '600' },
    tagModalSection: { fontSize: 13, fontWeight: '500', letterSpacing: 0.3 },
    tagInputRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderRadius: 12,
      paddingHorizontal: 12, paddingVertical: 4,
    },
    tagModalInput: { flex: 1, fontSize: 15, paddingVertical: 10 },

    bottomBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 10,
      backgroundColor: t.card, borderTopWidth: 0.5, borderTopColor: t.border,
    },
    plusButton: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: t.inputBg, alignItems: 'center', justifyContent: 'center',
    },
    plusMenu: {
      position: 'absolute', left: 16, bottom: 68, zIndex: 20,
      borderRadius: 14, width: 180, overflow: 'hidden',
      borderWidth: 0.5, borderColor: t.border,
      shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: -2 },
      elevation: 8,
    },
    plusMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    plusMenuText: { fontSize: 15, fontWeight: '500' },
    saveButton: {
      flex: 1, backgroundColor: t.accent, padding: 14,
      borderRadius: 16, alignItems: 'center',
    },
    saveButtonDisabled: { backgroundColor: t.sub },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
  })
}
