import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, Image,
} from 'react-native'
import { router, Redirect } from 'expo-router'
import { supabase } from '@/lib/supabase'

const BRAND_BLUE = '#1B4FD8'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  // Skip straight past the form if a session is already stored — the
  // (student) tab layout re-validates the role/type anyway.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setSessionChecked(true)
    })
  }, [])

  const handleLogin = async () => {
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError('Неверный email или пароль')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, student_type')
      .eq('id', data.user.id)
      .single()

    // This app only implements the online student cabinet — mirrors the
    // web app's role-based redirect, just narrowed to the one role/type
    // combination the mobile screens actually support.
    if (!profile || profile.role !== 'student' || profile.student_type !== 'online') {
      await supabase.auth.signOut()
      setError('Это приложение доступно только онлайн-ученикам')
      setLoading(false)
      return
    }

    setLoading(false)
    router.replace('/(student)')
  }

  if (!sessionChecked) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={BRAND_BLUE} size="large" />
      </View>
    )
  }

  if (hasSession) {
    return <Redirect href="/(student)" />
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <View style={styles.logoBox}>
          <Image source={require('@/assets/icon.png')} style={styles.logoImage} resizeMode="cover" />
        </View>
        <Text style={styles.title}>Жангак</Text>
        <Text style={styles.subtitle}>Вход в личный кабинет</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@gmail.com"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />

          <Text style={styles.label}>Пароль</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            editable={!loading}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [styles.button, (loading || pressed) && styles.buttonPressed]}
            onPress={handleLogin}
            disabled={loading || !email.trim() || !password}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Войти →</Text>}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: BRAND_BLUE,
    overflow: 'hidden',
    marginBottom: 16,
  },
  logoImage: { width: '100%', height: '100%' },
  title: { fontSize: 26, fontWeight: '900', color: '#0D1E4A' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 32 },
  form: { width: '100%' },
  label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0D1E4A',
    marginBottom: 16,
  },
  error: {
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    backgroundColor: BRAND_BLUE,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
})
