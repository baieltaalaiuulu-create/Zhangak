'use client'

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        background: '#F5F8FF',
        fontFamily: 'Inter, -apple-system, sans-serif',
        color: '#0D1E4A',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          background: '#1B4FD8',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 28px rgba(27,79,216,0.28)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static asset, offline fallback must not depend on next/image's optimizer */}
        <img src="/images/logo.png" alt="Жангак" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      <div style={{ fontSize: '40px' }}>📡</div>

      <h1 style={{ fontSize: '20px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
        Нет интернета
      </h1>
      <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '320px', lineHeight: 1.6, margin: 0 }}>
        Подключитесь и попробуйте снова.
      </p>

      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          marginTop: '8px',
          background: '#1B4FD8',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 28px',
          fontWeight: 800,
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0 8px 28px rgba(27,79,216,0.28)',
        }}
      >
        Повторить попытку
      </button>
    </div>
  )
}
