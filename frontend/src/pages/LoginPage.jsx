// src/pages/LoginPage.jsx

import { useState } from 'react';
import { Stamp, AlertCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { palette, fonts } from '../theme';

export default function LoginPage() {
  const { login, loginError, isLoggingIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    login(email, password);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: palette.paper,
      }}
    >
      <div style={{ width: 380 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <svg width="68" height="68" viewBox="0 0 68 68" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* LEFT CHEVRON (DARK BLUE) */}
            {/* Front face */}
            <path d="M26 12L36 34L26 56H14L24 34L14 12H26Z" fill="#1d3593" />
            {/* Shadow / Side face */}
            <path d="M14 12L24 34L14 56H8L18 34L8 12H14Z" fill="#0f2066" />

            {/* RIGHT CHEVRON (BRIGHT GREEN) */}
            {/* Front face */}
            <path d="M54 12L64 34L54 56H42L52 34L42 12H54Z" fill="#00df00" />
            {/* Shadow / Side face */}
            <path d="M42 12L52 34L42 56H36L46 34L36 12H42Z" fill="#00aa00" />
          </svg>
        </div>
        </div>
          <div style={{ fontFamily: fonts.display, fontSize: 22, color: palette.navy, textAlign: 'center' }}>
            FORTUNA ENGLISH GLOBAL LEARNING
          </div>
          <div style={{ fontSize: 13, color: palette.muted, marginTop: 4 }}>Portal Slip Gaji</div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: '#fff',
            border: `1px solid ${palette.line}`,
            borderRadius: 12,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <label style={{ fontSize: 12, color: palette.muted, display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="nama@perusahaan.co.id"
              style={{
                width: '100%',
                padding: '11px 14px',
                border: `1px solid ${palette.line}`,
                borderRadius: 7,
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: palette.muted, display: 'block', marginBottom: 6 }}>
              Kata Sandi
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '11px 14px',
                border: `1px solid ${palette.line}`,
                borderRadius: 7,
                fontSize: 14,
              }}
            />
          </div>

          {loginError && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                background: '#fbeae8',
                color: palette.rust,
                fontSize: 13,
                padding: '10px 12px',
                borderRadius: 7,
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{loginError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            style={{
              background: palette.navy,
              color: palette.paper,
              border: 'none',
              borderRadius: 7,
              padding: '13px 0',
              fontSize: 14,
              fontWeight: 600,
              cursor: isLoggingIn ? 'default' : 'pointer',
              opacity: isLoggingIn ? 0.7 : 1,
              marginTop: 4,
            }}
          >
            {isLoggingIn ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
