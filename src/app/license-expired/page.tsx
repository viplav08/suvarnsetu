export default function LicenseExpiredPage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>License Expired — SuvarnSetu</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, -apple-system, Arial, sans-serif; background: #F5F0E6; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        `}</style>
      </head>
      <body>
        <div style={{ maxWidth: 480, width: '100%', background: '#fff', borderRadius: 20, padding: '48px 40px', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.10)', border: '1px solid #E5DDD0' }}>

          {/* Icon */}
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEE2E2', border: '2px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>
            🔒
          </div>

          {/* Heading */}
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1A1008', marginBottom: 8, fontFamily: 'Georgia, serif' }}>
            License Expired
          </h1>
          <p style={{ fontSize: 14, color: '#7A6A5A', marginBottom: 32, lineHeight: 1.6 }}>
            Your SuvarnSetu subscription has expired.<br />
            Please renew to continue accessing your account.
          </p>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #E5DDD0', marginBottom: 28 }} />

          {/* Contact section */}
          <p style={{ fontSize: 13, fontWeight: 700, color: '#7A6A5A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Contact us to renew
          </p>

          <a href="mailto:comedgelabs@gmail.com"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#FBF8F0', border: '1px solid #E5DDD0', borderRadius: 10, padding: '14px 20px', marginBottom: 10, textDecoration: 'none', color: '#1A1008', fontSize: 14, fontWeight: 600 }}>
            <span style={{ fontSize: 20 }}>✉</span>
            comedgelabs@gmail.com
          </a>

          <a href="tel:+919581173078"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#FBF8F0', border: '1px solid #E5DDD0', borderRadius: 10, padding: '14px 20px', textDecoration: 'none', color: '#1A1008', fontSize: 14, fontWeight: 600 }}>
            <span style={{ fontSize: 20 }}>📞</span>
            +91 95811 73078
          </a>

          <p style={{ fontSize: 12, color: '#7A6A5A', marginTop: 24 }}>
            Powered by <strong>ComedgeLabs</strong> · SuvarnSetu
          </p>
        </div>
      </body>
    </html>
  )
}
