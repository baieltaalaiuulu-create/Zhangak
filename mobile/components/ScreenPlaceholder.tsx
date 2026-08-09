import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface Props {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description: string
}

// Shared "coming soon" shell for screens this scaffold only stubs out
// (Тренажёр / Пробный ОРТ / AI коуч) — same basic-structure scope as the
// other screens, ready to be filled in with the real flow later.
export default function ScreenPlaceholder({ icon, title, description }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={28} color="#1B4FD8" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#191B23', textAlign: 'center' },
  description: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
})
