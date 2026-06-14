'use client'

export default function MobileToggle() {
  function toggle() {
    const isOpen = document.body.classList.toggle('sidebar-open')
    const overlay = document.getElementById('mobile-overlay')
    if (overlay) overlay.style.display = isOpen ? 'block' : 'none'
  }
  return (
    <button onClick={toggle}
      style={{ background:'none', border:'none', cursor:'pointer', color:'#fff', fontSize:24, padding:'4px 8px', lineHeight:1, display:'flex', alignItems:'center' }}
      aria-label="Toggle menu">
      ☰
    </button>
  )
}
