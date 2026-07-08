// src/pages/SharedPayslipView.jsx
//
// Rendered when someone opens a manager-shared payslip link
// (http://localhost:5173/slip/<token>). Login is already enforced by
// App.jsx before this ever renders -- this component's only job is to
// fetch that one specific PDF and hand it straight to the browser.
// The real access check (does this logged-in employee actually own
// this payslip, or are they ADMIN_HR) happens server-side in
// pdfController.js -- never trust anything client-side for that.

import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';

export default function SharedPayslipView({ shareToken }) {
  const { token, logout } = useAuth();
  const [status, setStatus] = useState('loading'); // 'loading' | 'error'
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchSharedPdf() {
      try {
        const res = await fetch(`http://localhost:3000/api/payslips/share/${shareToken}/pdf`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Slip gaji tidak ditemukan, atau Anda tidak berhak mengaksesnya.');
        }
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        window.location.replace(url);
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorText(err.message);
        }
      }
    }

    fetchSharedPdf();
    return () => { cancelled = true; };
  }, [shareToken, token]);

  if (status === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ color: '#9b1c1c', marginBottom: '12px' }}>Tidak dapat membuka slip gaji</h2>
        <p style={{ color: '#4b5563', maxWidth: '420px' }}>{errorText}</p>
        <button onClick={logout} style={{ marginTop: '20px', padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
          Keluar dan login ulang
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#4b5563' }}>
      Membuka slip gaji...
    </div>
  );
}
