// src/components/UpgradePrompt.tsx

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'

const ICONS: Record<string, string> = {
  reports: '📊', crm: '🎂', dataExport: '📥', default: '🔒',
}

export default function UpgradePrompt({ feature, title, description, requiredPlan }: {
  feature: string; title: string; description: string; requiredPlan: string
}) {
  return (
    <div style={{ padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: BORDER, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>{ICONS[feature] ?? ICONS.default}</div>
        <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 28, fontWeight: 400, color: TEXT, marginBottom: 12 }}>
          {title}
        </h2>
        <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, marginBottom: 28 }}>{description}</p>
        <div style={{ background: '#FBF8F0', borderRadius: 10, border: `1px solid ${GOLD}55`, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Available on</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: GOLD }}>{requiredPlan} Plan and above</div>
        </div>
        <a href="https://wa.me/919581173078?text=I want to upgrade my SuvarnSetu plan"
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', background: GOLD, color: '#fff', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
          Upgrade Now — Contact ComedgeLabs
        </a>
        <div style={{ marginTop: 12, fontSize: 12.5, color: MUTED }}>📞 +91 95811 73078 · comedgelabs@gmail.com</div>
      </div>
    </div>
  )
}
