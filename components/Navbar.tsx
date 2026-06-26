'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Tab {
  id: string
  label: string
}

interface NavbarProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
  role: string
}

export default function Navbar({ tabs, activeTab, onTabChange, role }: NavbarProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav style={{
      background: '#0071E3',
      padding: '0 28px',
      height: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* ЛОГО */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32,
          background: 'rgba(255,255,255,0.2)',
          borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#fff'
        }}>Ж</div>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Zhangak</span>
      </div>

      {/* ТАБЫ */}
      <div style={{
        display: 'flex', gap: 2,
        background: 'rgba(255,255,255,0.12)',
        padding: 4, borderRadius: 10
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            style={{
              padding: '6px 16px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              transition: 'all 0.15s',
              background: activeTab === t.id ? 'rgba(255,255,255,0.22)' : 'transparent',
              color: activeTab === t.id ? '#fff' : 'rgba(255,255,255,0.65)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* РОЛЬ + ВЫХОД */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{
          background: 'rgba(255,255,255,0.2)',
          color: '#fff',
          fontSize: 11,
          padding: '4px 12px',
          borderRadius: 20,
          fontWeight: 600,
        }}>
          {role}
        </span>
        <button onClick={handleLogout} style={{
          background: '#FFF0F0',
          color: '#D92F2F',
          border: 'none',
          borderRadius: 7,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          Чыгуу
        </button>
      </div>
    </nav>
  )
}