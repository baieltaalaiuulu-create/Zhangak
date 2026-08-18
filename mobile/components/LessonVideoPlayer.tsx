import { useCallback, useState } from 'react'
import { View, StyleSheet, Text, Pressable, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { WebView } from 'react-native-webview'

import { requestLessonVideo, type LessonVideoConfig, type LessonVideoHandle } from '@/lib/lessons'

interface Props {
  handle: LessonVideoHandle | null
  title: string
}

/**
 * Companion lesson video, on the same contract as the web player.
 *
 * The WebView is created only after the student taps play, and the video id
 * arrives from the first-party session route at that moment — so a cached
 * lesson, a revoked enrollment or a locked lesson cannot produce a playable
 * embed. The embed itself uses the privacy-enhanced host.
 *
 * This is an access boundary, not DRM: a viewer who is allowed to watch
 * necessarily receives the id. See docs/operations/lesson-video.md.
 */
export default function LessonVideoPlayer({ handle, title }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [config, setConfig] = useState<LessonVideoConfig | null>(null)

  const start = useCallback(async () => {
    if (!handle) return
    setStatus('loading')
    try {
      setConfig(await requestLessonVideo(handle))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [handle])

  if (!handle) {
    return (
      <View style={[styles.media, styles.placeholder]}>
        <Ionicons name="videocam-outline" size={32} color="#9CA3AF" accessibilityElementsHidden />
        <Text style={styles.placeholderText}>Видео скоро появится</Text>
      </View>
    )
  }

  if (status === 'ready' && config) {
    return (
      <View style={styles.media}>
        <WebView
          source={{ uri: `${config.embedHost}/embed/${config.videoId}?playsinline=1&rel=0` }}
          style={styles.media}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
    )
  }

  return (
    <Pressable
      onPress={() => void start()}
      disabled={status === 'loading'}
      accessibilityRole="button"
      accessibilityLabel={`Смотреть видео: ${title}`}
      style={[styles.media, styles.placeholder]}
    >
      {status === 'loading'
        ? <ActivityIndicator color="#FFFFFF" />
        : <Ionicons name={status === 'error' ? 'refresh-outline' : 'play-circle'} size={44} color="#FFFFFF" accessibilityElementsHidden />}
      <Text style={styles.placeholderText}>
        {status === 'error' ? 'Видео не открылось. Нажми, чтобы повторить' : status === 'loading' ? 'Открываем видео…' : 'Смотреть видео'}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  media: { width: '100%', aspectRatio: 16 / 9, minHeight: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111827' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  placeholderText: { color: '#D1D5DB', fontSize: 13, textAlign: 'center' },
})
