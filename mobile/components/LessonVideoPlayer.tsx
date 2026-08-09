import { View, StyleSheet, Text } from 'react-native'
import { WebView } from 'react-native-webview'
import { VideoView, useVideoPlayer } from 'expo-video'

interface Props {
  videoUrl: string | null
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return match ? match[1] : null
}

// Lesson videos are stored as YouTube URLs (same as web — see
// lib/lessons-data.ts's getYoutubeEmbed), so most lessons render through a
// WebView pointed at the YouTube iframe embed, exactly like the web app's
// <iframe>. expo-video (useVideoPlayer/VideoView) is used as a fallback for
// the case a lesson ever points at a direct video file instead.
function DirectVideoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, p => { p.loop = false })
  return <VideoView player={player} style={styles.media} nativeControls contentFit="contain" />
}

export default function LessonVideoPlayer({ videoUrl }: Props) {
  if (!videoUrl) {
    return (
      <View style={[styles.media, styles.placeholder]}>
        <Text style={styles.placeholderEmoji}>🎬</Text>
        <Text style={styles.placeholderText}>Видео скоро появится</Text>
      </View>
    )
  }

  const youtubeId = extractYoutubeId(videoUrl)
  if (youtubeId) {
    return (
      <View style={styles.media}>
        <WebView
          source={{ uri: `https://www.youtube.com/embed/${youtubeId}?playsinline=1` }}
          style={styles.media}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
    )
  }

  return <DirectVideoPlayer url={videoUrl} />
}

const styles = StyleSheet.create({
  media: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111827' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholderEmoji: { fontSize: 32 },
  placeholderText: { color: '#9CA3AF', fontSize: 13 },
})
