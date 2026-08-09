import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Tabs, Redirect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const BRAND_BLUE = '#1B4FD8'
const INACTIVE_GRAY = '#9CA3AF'

// Central auth gate for every screen under (student) — redirects to
// /login the moment there's no session, so individual screens don't each
// need to re-implement this check on mount.
function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecked(true)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  return { session, checked }
}

// 5 tabs, same set and order as the web bottom nav
// (components/student/BottomNav.tsx): Главная / Уроки / Тренажёр / ОРТ / AI.
export default function StudentTabsLayout() {
  const { session, checked } = useSession()

  if (!checked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6FA' }}>
        <ActivityIndicator color={BRAND_BLUE} size="large" />
      </View>
    )
  }

  if (!session) {
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
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
