'use client'

export default function MobileToggle() {
  function toggle() {
    document.body.classList.toggle('sidebar-open')
    const overlay = document.getElementById('mobile-overlay')
    if (overlay) overlay.style.display = document.body.classList.contains('sidebar-open') ? 'block' : 'none'
  }
  return (
    <button
      onClick={toggle}
      style={{ background:'none', border:'none', cursor:'pointer', color:'#fff', fontSize:22, padding:'4px 6px', lineHeight:1 }}
      aria-label="Toggle menu"
    >
      ☰
    </button>
  )
}
