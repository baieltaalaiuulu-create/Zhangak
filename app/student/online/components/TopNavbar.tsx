'use client'

import { useState } from 'react'

interface TopNavbarProps {
  fullName: string
  daysToOrt: number
  onLogout: () => void
}

const NAV_LINKS = [
  { label: 'Кабинет', href: '#hero' },
  { label: 'План дня', href: '#daily-plan' },
  { label: 'Предметы', href: '#subjects' },
  { label: 'Прогресс', href: '#stats' },
]

export default function TopNavbar({ fullName, daysToOrt, onLogout }: TopNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const initial = fullName?.[0]?.toUpperCase() ?? '?'

  return (
    <nav style={{
      background: '#fff',
      borderBottom: '1px solid #EEF1F6',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div className="ozb-nav-inner" style={{
        maxWidth: '1180px',
        margin: '0 auto',
        padding: '0 28px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/images/logo.png" alt="Zhangak" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '15px', color: '#0D1E4A', letterSpacing: '-0.2px' }}>Zhangak</span>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1B4FD8', flexShrink: 0 }} />
        </div>

        <div className="ozb-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'center' }}>
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#5B6472',
                textDecoration: 'none',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F4F6FA'; e.currentTarget.style.color = '#0D1E4A' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5B6472' }}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#EEF2FF', color: '#1B4FD8',
            fontSize: '12px', fontWeight: 700,
            padding: '6px 12px', borderRadius: '999px',
            whiteSpace: 'nowrap',
          }}>
            ⏳ {daysToOrt} {pluralDays(daysToOrt)} до ОРТ
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: '#1B4FD8', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '13px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {initial}
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '40px',
                background: '#fff', border: '1px solid #EEF1F6',
                borderRadius: '12px', boxShadow: '0 12px 32px rgba(13,30,74,0.12)',
                padding: '8px', minWidth: '160px', zIndex: 200,
              }}>
                <div style={{ padding: '8px 10px', fontSize: '12px', color: '#94A3B8', borderBottom: '1px solid #F1F5F9', marginBottom: '4px' }}>
                  {fullName}
                </div>
                <button
                  onClick={onLogout}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    color: '#D92F2F', fontSize: '13px', fontWeight: 600, padding: '8px 10px',
                    borderRadius: '8px', cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FFF0F0' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  Чыгуу
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

function pluralDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'дней'
  if (mod10 === 1) return 'день'
  if (mod10 >= 2 && mod10 <= 4) return 'дня'
  return 'дней'
}
