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
      background: '#1B4FD8',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div className="ozb-nav-inner" style={{
        maxWidth: '1180px',
        margin: '0 auto',
        padding: '0 24px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0, minWidth: 0 }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/images/logo.png" alt="Zhangak" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '15px', color: '#fff', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>Zhangak</span>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FDBA74', flexShrink: 0 }} />
        </div>

        <div className="ozb-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, minWidth: 0, justifyContent: 'center', overflow: 'hidden' }}>
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.16)', color: '#fff',
            fontSize: '12px', fontWeight: 700,
            padding: '6px 12px', borderRadius: '999px',
            whiteSpace: 'nowrap',
          }}>
            ⏳ {daysToOrt} {pluralDays(daysToOrt)} до ОРТ
          </div>

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: '#fff', color: '#1B4FD8',
                border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '13px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
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
                <div style={{ padding: '8px 10px', fontSize: '12px', color: '#94A3B8', borderBottom: '1px solid #F1F5F9', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
