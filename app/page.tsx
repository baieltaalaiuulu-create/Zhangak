'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Неверный email или пароль: ' + error.message)
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      router.push('/admin')
      return
    }

    if (profile.role === 'admin') {
      router.push('/admin')
    } else if (profile.role === 'teacher') {
      router.push('/teacher')
    } else {
      router.push('/student')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'var(--bg)'}}>
      <div className="w-full max-w-md p-8 rounded-2xl" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
        <div className="text-center mb-8">
          <div className="text-2xl font-black mb-1" style={{
            background:'linear-gradient(90deg,#4B8EF5,#D45FCC)',
            WebkitBackgroundClip:'text',
            WebkitTextFillColor:'transparent'
          }}>
            ЖАНГАК
          </div>
          <div className="text-sm" style={{color:'var(--muted)'}}>
            Система управления обучением
          </div>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium mb-2 block" style={{color:'var(--muted)'}}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="example@gmail.com" required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text)'}} />
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block" style={{color:'var(--muted)'}}>Пароль</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text)'}} />
          </div>

          {error && (
            <div className="text-sm text-center px-4 py-3 rounded-xl"
              style={{background:'rgba(255,107,107,0.1)',color:'#FF6B6B',border:'1px solid rgba(255,107,107,0.2)'}}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{
              background:'linear-gradient(90deg,#4B8EF5,#D45FCC)',
              color:'#fff',
              opacity:loading ? 0.7 : 1,
              cursor:loading ? 'not-allowed' : 'pointer'
            }}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <div className="text-center mt-6 text-xs" style={{color:'var(--muted)'}}>
          Жангак © 2025 · Образовательный центр
        </div>
      </div>
    </div>
  )
}