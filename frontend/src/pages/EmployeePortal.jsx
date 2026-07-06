// src/pages/EmployeePortal.jsx

import { useState, useEffect } from 'react';
import { ChevronRight, Download, LogOut, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { api, ApiError } from '../api/client';
import { palette, fonts, formatIDR, monthName } from '../theme';

function Seal({ size = 40 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${palette.gold}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: size - 8,
          height: size - 8,
          borderRadius: '50%',
          border: `1px solid ${palette.gold}`,
        }}
      />
    </div>
  );
}

function StatusBadge({ status }) {
  const isFinalized = status === 'FINALIZED' || status === 'SENT';
  return (
    <span
      style={{
        background: isFinalized ? '#eaf1ea' : '#f5f0e2',
        color: isFinalized ? palette.sage : palette.gold,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '4px 10px',
        borderRadius: 20,
      }}
    >
      {isFinalized ? 'Disahkan' : 'Draf'}
    </span>
  );
}

export default function EmployeePortal() {
  const { token, employee, logout } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [downloadState, setDownloadState] = useState('idle'); // idle | downloading | error

  useEffect(() => {
    let cancelled = false;
    setIsLoadingList(true);
    api
      .listPayslips(token)
      .then((data) => {
        if (cancelled) return;
        setPayslips(data.payslips);
        if (data.payslips.length > 0) {
          setSelectedId(data.payslips[0].payslipId);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    setIsLoadingDetail(true);
    api
      .getPayslip(token, selectedId)
      .then((data) => {
        if (!cancelled) setSelectedDetail(data.payslip);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, token]);

  async function handleDownloadPdf() {
    setDownloadState('downloading');
    try {
      // Fetched as a blob with the Authorization header attached manually,
      // since a plain <a href> or window.open() can't send custom headers.
      // This keeps the JWT out of the URL entirely (no token in browser
      // history, server access logs, or the Referer header).
      const response = await fetch(api.getPayslipPdfUrl(selectedId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gagal mengunduh PDF (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${selectedId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadState('idle');
    } catch (err) {
      setDownloadState('error');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: palette.paper }}>
      <header
        style={{
          background: palette.navy,
          color: palette.paper,
          padding: '24px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Seal />
          <div>
            <div style={{ fontFamily: fonts.display, fontSize: 19 }}>FORTUNA ENGLISH GLOBAL LEARNING</div>
            <div style={{ fontSize: 11, opacity: 0.65 }}>Portal Slip Gaji Karyawan</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{employee.fullName}</div>
            <div style={{ fontSize: 11, opacity: 0.65 }}>{employee.jobTitle}</div>
          </div>
          <button
            onClick={logout}
            title="Keluar"
            style={{
              background: 'transparent',
              border: `1px solid rgba(250,248,244,0.3)`,
              color: palette.paper,
              borderRadius: 6,
              padding: '7px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px' }}>
        {loadError && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              background: '#fbeae8',
              color: palette.rust,
              padding: '14px 18px',
              borderRadius: 8,
              marginBottom: 24,
              fontSize: 14,
            }}
          >
            <AlertCircle size={18} />
            {loadError}
          </div>
        )}

        {isLoadingList ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: palette.muted, padding: '40px 0' }}>
            <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            Memuat slip gaji...
          </div>
        ) : payslips.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 0',
              color: palette.muted,
              fontFamily: fonts.display,
              fontSize: 18,
            }}
          >
            Belum ada slip gaji yang tersedia.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 40 }}>
            <div>
              <div style={{ fontFamily: fonts.display, fontSize: 22, color: palette.navy, marginBottom: 4 }}>
                Riwayat Slip Gaji
              </div>
              <div style={{ fontSize: 13, color: palette.muted, marginBottom: 24 }}>
                {payslips.length} dokumen tersedia
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {payslips.map((p) => {
                  const isSelected = p.payslipId === selectedId;
                  return (
                    <button
                      key={p.payslipId}
                      onClick={() => setSelectedId(p.payslipId)}
                      style={{
                        background: isSelected ? palette.navy : '#fff',
                        border: `1px solid ${isSelected ? palette.navy : palette.line}`,
                        borderRadius: 8,
                        padding: '16px 18px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: fonts.display,
                            fontSize: 16,
                            color: isSelected ? palette.paper : palette.charcoal,
                            marginBottom: 3,
                          }}
                        >
                          {monthName(p.periodMonth)} {p.periodYear}
                        </div>
                        <div style={{ fontSize: 12, color: isSelected ? 'rgba(250,248,244,0.7)' : palette.muted }}>
                          {formatIDR(p.netPay)}
                        </div>
                      </div>
                      <ChevronRight size={16} color={isSelected ? palette.paper : '#b5af9f'} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              {isLoadingDetail || !selectedDetail ? (
                <div style={{ color: palette.muted, padding: '40px 0' }}>Memuat detail...</div>
              ) : (
                <PayslipDetailCard
                  payslip={selectedDetail}
                  onDownload={handleDownloadPdf}
                  downloadState={downloadState}
                />
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PayslipDetailCard({ payslip, onDownload, downloadState }) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${palette.line}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: palette.navy,
          padding: '28px 36px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div style={{ color: palette.paper, fontFamily: fonts.display, fontSize: 22 }}>Slip Gaji</div>
          <div style={{ color: 'rgba(250,248,244,0.7)', fontSize: 13, marginTop: 4 }}>
            Periode {monthName(payslip.periodMonth)} {payslip.periodYear}
          </div>
        </div>
        <StatusBadge status={payslip.status} />
      </div>

      <div style={{ padding: '32px 36px' }}>
        <Row label="Gaji Pokok" value={Number(payslip.basicSalary)} />
        {payslip.earningDetails?.map((e) => (
          <Row key={e.earningId} label={e.label} value={Number(e.amount)} small />
        ))}
        <div style={{ height: 1, background: palette.line, margin: '14px 0' }} />
        <Row label="Total Pendapatan" value={Number(payslip.totalEarnings)} bold />

        <div style={{ height: 24 }} />

        {payslip.deductionDetails?.map((d) => (
          <Row key={d.deductionId} label={d.label} value={-Number(d.amount)} small negative />
        ))}
        <div style={{ height: 1, background: palette.line, margin: '14px 0' }} />
        <Row label="Total Potongan" value={-Number(payslip.totalDeductions)} bold negative />

        <div
          style={{
            marginTop: 28,
            background: palette.navy,
            borderRadius: 8,
            padding: '18px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'rgba(250,248,244,0.75)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>
            Gaji Bersih
          </span>
          <span style={{ color: palette.paper, fontFamily: fonts.display, fontSize: 26, fontWeight: 700 }}>
            {formatIDR(payslip.netPay)}
          </span>
        </div>

        {payslip.status === 'DRAFT' ? (
          <div
            style={{
              marginTop: 20,
              textAlign: 'center',
              fontSize: 13,
              color: palette.muted,
              padding: '13px 0',
              border: `1px dashed ${palette.line}`,
              borderRadius: 8,
            }}
          >
            PDF belum tersedia — slip gaji ini masih dalam status draf.
          </div>
        ) : (
          <>
            <button
              onClick={onDownload}
              disabled={downloadState === 'downloading'}
              style={{
                width: '100%',
                marginTop: 20,
                background: 'transparent',
                border: `1.5px solid ${palette.navy}`,
                color: palette.navy,
                borderRadius: 8,
                padding: '13px 0',
                fontSize: 14,
                fontWeight: 600,
                cursor: downloadState === 'downloading' ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: downloadState === 'downloading' ? 0.6 : 1,
              }}
            >
              <Download size={16} />
              {downloadState === 'downloading' ? 'Mengunduh...' : 'Unduh PDF (Terenkripsi)'}
            </button>
            {downloadState === 'error' && (
              <div style={{ textAlign: 'center', fontSize: 12, color: palette.rust, marginTop: 8 }}>
                Gagal mengunduh PDF. Coba lagi.
              </div>
            )}
            <div style={{ textAlign: 'center', fontSize: 11, color: palette.muted, marginTop: 8 }}>
              Kata sandi: tanggal lahir + 4 digit NIK terakhir
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, small, negative }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: small ? '6px 0' : '9px 0',
        fontSize: bold ? 15 : 14,
        fontWeight: bold ? 700 : 400,
        color: negative ? palette.rust : palette.charcoal,
      }}
    >
      <span style={{ color: bold ? palette.charcoal : small ? palette.muted : palette.charcoal }}>{label}</span>
      <span style={{ fontFamily: fonts.display }}>
        {value < 0 ? '−' : ''}
        {formatIDR(Math.abs(value))}
      </span>
    </div>
  );
}
