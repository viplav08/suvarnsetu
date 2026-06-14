'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'

export default function LayoutShell({ children, role, plan, trialBanner, notificationBar }: {
  children:        React.ReactNode
  role:            string
  plan:            string
  trialBanner:     React.ReactNode
  notificationBar: React.ReactNode
}) {
  const [open,     setOpen]     = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close sidebar when navigating on mobile
  useEffect(() => { if (isMobile) setOpen(false) }, [isMobile])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F0E6' }}>

      {/* Mobile overlay */}
      {isMobile && open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 998 }} />
      )}

      {/* Sidebar */}
      <div style={{
        position:   isMobile ? 'fixed' : 'relative',
        top: 0, left: 0, bottom: 0,
        zIndex:     999,
        transform:  isMobile && !open ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.22s ease',
        flexShrink: 0,
      }}>
        <Sidebar role={role} plan={plan as any} />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Mobile top bar */}
        {isMobile && (
          <div style={{ background: '#1B1108', height: 52, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0, zIndex: 100 }}>
            <button onClick={() => setOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22, padding: '4px 6px', lineHeight: 1 }}>
              {open ? '✕' : '☰'}
            </button>
            <span style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 16 }}>SuvarnSetu</span>
          </div>
        )}

        {trialBanner}

        {/* Notification bar — desktop only */}
        {!isMobile && notificationBar}

        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
