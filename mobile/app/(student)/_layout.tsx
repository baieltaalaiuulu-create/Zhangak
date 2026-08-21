import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { Tabs, Redirect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useNativeAuth } from '@/components/NativeAuthProvider'
import { isSupportedNativeStudent } from '@/lib/native-auth'

const BRAND_BLUE = '#1B3F92'
const INACTIVE_GRAY = '#9CA3AF'

// Native companion exposes the four implemented learning destinations.
export default function StudentTabsLayout() {
  const { status, session, error, retrySessionCheck, signOut } = useNativeAuth()

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6FA' }}>
        <ActivityIndicator color={BRAND_BLUE} size="large" />
      </View>
    )
  }

  if (status === 'error') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6FA', gap: 12, padding: 28 }}>
        <Text style={{ color: '#374151', fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
          Не удалось проверить вход
        </Text>
        <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
          {error ?? 'Проверьте подключение к интернету и попробуйте снова.'}
        </Text>
        <Pressable
          onPress={() => { void retrySessionCheck() }}
          style={{ backgroundColor: BRAND_BLUE, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Повторить</Text>
        </Pressable>
        <Pressable onPress={() => { void signOut() }} style={{ padding: 10 }}>
          <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '700' }}>Выйти из аккаунта</Text>
        </Pressable>
      </View>
    )
  }

  if (status !== 'authenticated' || !session || !isSupportedNativeStudent(session.user)) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND_BLUE,
        tabBarInactiveTintColor: INACTIVE_GRAY,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lessons"
        options={{
          title: 'Уроки',
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Тренажёр',
          tabBarIcon: ({ color, size }) => <Ionicons name="create-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ort"
        options={{
          title: 'ОРТ',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
