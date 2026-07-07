import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';

const AdminDashboard = () => {
  const { token, logout } = useAuth();

  // --- Employee list state (real API, not mock data) ---
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // --- Add Employee modal state ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: '',
    jobTitle: '',
    email: '',
    bankAccountNo: '',
    password: '',
    employmentStatus: 'PERMANENT',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addMessage, setAddMessage] = useState({ type: '', text: '' });

  // --- Edit Employee modal state ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    employeeId: null,
    fullName: '',
    jobTitle: '',
    employmentStatus: 'PERMANENT',
    email: '',
    bankAccountNo: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState({ type: '', text: '' });

  // --- Delete Employee state ---
  const [deletingId, setDeletingId] = useState(null); // employeeId currently mid-delete (disables its row buttons)
  const [rowMessage, setRowMessage] = useState({ employeeId: null, type: '', text: '' }); // per-row error, e.g. FK conflict

  // --- Payslip directory state ---
  const [payslips, setPayslips] = useState([]);
  const [loadingPayslips, setLoadingPayslips] = useState(true);
  const [payslipRowMessage, setPayslipRowMessage] = useState({ payslipId: null, type: '', text: '' });
  const [viewingId, setViewingId] = useState(null); // payslipId currently mid-download (disables its Lihat button)
  const [markingSentId, setMarkingSentId] = useState(null); // payslipId currently mid-mark-as-sent

  // --- Create Payslip ("Buat Slip Gaji") modal state ---
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const emptyPayslipForm = {
    employeeId: '',
    periodMonth: String(new Date().getMonth() + 1),
    periodYear: String(new Date().getFullYear()),
    issueDate: new Date().toISOString().slice(0, 10),
    issueLocation: 'Kupang',
    basicSalary: '',
    authorizedSignatory: '',
    earnings: [],
    deductions: [],
  };
  const [payslipForm, setPayslipForm] = useState(emptyPayslipForm);
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [payslipMessage, setPayslipMessage] = useState({ type: '', text: '' });

  // --- Bulk import state ---
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importMessage, setImportMessage] = useState({ type: '', text: '' });

  // Fetch real employee list from API
  const fetchEmployees = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Fetch real payslip directory from API (ADMIN_HR sees all payslips)
  const fetchPayslips = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/payslips', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setPayslips(data.payslips || []);
      }
    } catch (err) {
      console.error('Failed to fetch payslips:', err);
    } finally {
      setLoadingPayslips(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchPayslips();
  }, [token]);

  // Derived stats from real data
  const totalEmployees = employees.length;
  const adminCount = employees.filter(e => e.role === 'ADMIN_HR').length;
  const employeeCount = employees.filter(e => e.role === 'EMPLOYEE').length;

  const summaryCards = [
    { title: 'Total Karyawan', count: totalEmployees, icon: '👥', color: '#eff6ff', iconColor: '#2563eb' },
    { title: 'Peran Admin HR', count: adminCount, icon: '✓', color: '#f0fdf4', iconColor: '#16a34a' },
    { title: 'Karyawan Biasa', count: employeeCount, icon: '🕒', color: '#fffbeb', iconColor: '#d97706' },
  ];

  // Handle add employee form submission
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddMessage({ type: '', text: '' });

    try {
      const res = await fetch('http://localhost:3000/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();

      if (res.ok) {
        setAddMessage({ type: 'success', text: `Karyawan "${data.employee.fullName}" berhasil ditambahkan.` });
        // Reset form
        setAddForm({ fullName: '', jobTitle: '', email: '', bankAccountNo: '', password: '', employmentStatus: 'PERMANENT' });
        // Refresh employee list
        fetchEmployees();
        // Close modal after short delay so user sees the success message
        setTimeout(() => {
          setShowAddModal(false);
          setAddMessage({ type: '', text: '' });
        }, 1500);
      } else {
        setAddMessage({ type: 'error', text: data.error || 'Gagal menambahkan karyawan.' });
      }
    } catch (err) {
      setAddMessage({ type: 'error', text: 'Tidak dapat terhubung ke server.' });
    } finally {
      setAddLoading(false);
    }
  };

  // Open the edit modal pre-filled with the selected employee's data
  const handleOpenEdit = (emp) => {
    setEditForm({
      employeeId: emp.employeeId,
      fullName: emp.fullName,
      jobTitle: emp.jobTitle,
      employmentStatus: emp.employmentStatus,
      email: emp.email,
      bankAccountNo: emp.bankAccountNo,
    });
    setEditMessage({ type: '', text: '' });
    setShowEditModal(true);
  };

  // Handle edit employee form submission
  const handleEditEmployee = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditMessage({ type: '', text: '' });

    const { employeeId, ...updates } = editForm;

    try {
      const res = await fetch(`http://localhost:3000/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json();

      if (res.ok) {
        setEditMessage({ type: 'success', text: `Data "${data.employee.fullName}" berhasil diperbarui.` });
        fetchEmployees();
        setTimeout(() => {
          setShowEditModal(false);
          setEditMessage({ type: '', text: '' });
        }, 1200);
      } else {
        setEditMessage({ type: 'error', text: data.error || 'Gagal memperbarui karyawan.' });
      }
    } catch (err) {
      setEditMessage({ type: 'error', text: 'Tidak dapat terhubung ke server.' });
    } finally {
      setEditLoading(false);
    }
  };

  // Handle delete employee (with confirmation + FK-conflict messaging)
  const handleDeleteEmployee = async (emp) => {
    const confirmed = window.confirm(
      `Hapus karyawan "${emp.fullName}"? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    setDeletingId(emp.employeeId);
    setRowMessage({ employeeId: null, type: '', text: '' });

    try {
      const res = await fetch(`http://localhost:3000/api/employees/${emp.employeeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 204) {
        fetchEmployees();
      } else {
        const data = await res.json().catch(() => ({}));
        // Foreign-key protection (employee still has payslips/audit history)
        // surfaces here as a clear, specific message rather than a generic failure.
        setRowMessage({
          employeeId: emp.employeeId,
          type: 'error',
          text: data.error || 'Gagal menghapus karyawan.',
        });
      }
    } catch (err) {
      setRowMessage({ employeeId: emp.employeeId, type: 'error', text: 'Tidak dapat terhubung ke server.' });
    } finally {
      setDeletingId(null);
    }
  };

  // --- Create Payslip ("Buat Slip Gaji") helpers ---

  const openPayslipModal = () => {
    setPayslipForm(emptyPayslipForm);
    setPayslipMessage({ type: '', text: '' });
    setShowPayslipModal(true);
  };

  const addEarningRow = () => {
    setPayslipForm(f => ({
      ...f,
      earnings: [...f.earnings, { label: '', category: 'ALLOWANCE', amount: '' }],
    }));
  };

  const removeEarningRow = (idx) => {
    setPayslipForm(f => ({ ...f, earnings: f.earnings.filter((_, i) => i !== idx) }));
  };

  const updateEarningRow = (idx, field, value) => {
    setPayslipForm(f => ({
      ...f,
      earnings: f.earnings.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    }));
  };

  const addDeductionRow = () => {
    setPayslipForm(f => ({
      ...f,
      deductions: [...f.deductions, { label: '', category: 'OTHER', amount: '' }],
    }));
  };

  const removeDeductionRow = (idx) => {
    setPayslipForm(f => ({ ...f, deductions: f.deductions.filter((_, i) => i !== idx) }));
  };

  const updateDeductionRow = (idx, field, value) => {
    setPayslipForm(f => ({
      ...f,
      deductions: f.deductions.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    }));
  };

  // Creates the payslip, then immediately finalizes it (generates the PDF)
  // in the same submit action -- HR just fills one form and gets a ready,
  // downloadable payslip, without needing to understand a separate
  // draft/finalize workflow.
  const handleCreatePayslip = async (e) => {
    e.preventDefault();
    setPayslipLoading(true);
    setPayslipMessage({ type: '', text: '' });

    const body = {
      employeeId: Number(payslipForm.employeeId),
      periodMonth: Number(payslipForm.periodMonth),
      periodYear: Number(payslipForm.periodYear),
      issueDate: payslipForm.issueDate,
      issueLocation: payslipForm.issueLocation,
      basicSalary: payslipForm.basicSalary,
      authorizedSignatory: payslipForm.authorizedSignatory,
      earnings: payslipForm.earnings
        .filter(row => row.label && row.amount !== '')
        .map(row => ({ label: row.label, category: row.category, amount: row.amount })),
      deductions: payslipForm.deductions
        .filter(row => row.label && row.amount !== '')
        .map(row => ({ label: row.label, category: row.category, amount: row.amount })),
    };

    try {
      const createRes = await fetch('http://localhost:3000/api/payslips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        setPayslipMessage({ type: 'error', text: createData.error || 'Gagal membuat slip gaji.' });
        return;
      }

      // Auto-finalize right away so the PDF is generated and ready.
      const finalizeRes = await fetch(
        `http://localhost:3000/api/payslips/${createData.payslip.payslipId}/finalize`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }
      );
      const finalizeData = await finalizeRes.json();

      if (!finalizeRes.ok) {
        // The payslip record exists (as DRAFT) even though finalize failed --
        // surface that clearly rather than pretending nothing happened.
        setPayslipMessage({
          type: 'error',
          text: `Slip gaji dibuat, tetapi gagal difinalisasi: ${finalizeData.error || 'kesalahan tidak diketahui'}. Slip tersimpan sebagai draf.`,
        });
        fetchPayslips();
        return;
      }

      setPayslipMessage({ type: 'success', text: 'Slip gaji berhasil dibuat dan difinalisasi.' });
      fetchPayslips();
      setTimeout(() => {
        setShowPayslipModal(false);
        setPayslipMessage({ type: '', text: '' });
      }, 1200);
    } catch (err) {
      setPayslipMessage({ type: 'error', text: 'Tidak dapat terhubung ke server.' });
    } finally {
      setPayslipLoading(false);
    }
  };

  // View/download the payslip PDF -- fetched as a blob with the auth
  // header attached manually (same pattern as the employee portal),
  // since a plain link or window.open() can't send custom headers and
  // the JWT should never end up in the URL.
  const handleViewPayslip = async (payslip) => {
    setViewingId(payslip.payslipId);
    setPayslipRowMessage({ payslipId: null, type: '', text: '' });
    try {
      const res = await fetch(`http://localhost:3000/api/payslips/${payslip.payslipId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Gagal mengunduh PDF (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${payslip.payslipId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setPayslipRowMessage({ payslipId: payslip.payslipId, type: 'error', text: 'Gagal membuka slip gaji.' });
    } finally {
      setViewingId(null);
    }
  };

  // Mark a finalized payslip as sent -- this is what turns on the
  // checklist mark in the directory, once HR has actually delivered the
  // payslip to the employee (there is no automatic mailer yet).
  const handleMarkSent = async (payslip) => {
    setMarkingSentId(payslip.payslipId);
    setPayslipRowMessage({ payslipId: null, type: '', text: '' });
    try {
      const res = await fetch(`http://localhost:3000/api/payslips/${payslip.payslipId}/mark-sent`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        fetchPayslips();
      } else {
        setPayslipRowMessage({ payslipId: payslip.payslipId, type: 'error', text: data.error || 'Gagal menandai terkirim.' });
      }
    } catch (err) {
      setPayslipRowMessage({ payslipId: payslip.payslipId, type: 'error', text: 'Tidak dapat terhubung ke server.' });
    } finally {
      setMarkingSentId(null);
    }
  };

  // Handle bulk CSV import
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && !selectedFile.name.endsWith('.csv')) {
      setImportMessage({ type: 'error', text: 'Pilih file CSV yang valid.' });
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setImportMessage({ type: '', text: '' });
  };

  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setImportMessage({ type: '', text: '' });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('http://localhost:3000/api/payslips/bulk-import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setImportMessage({ type: 'success', text: data.message || 'CSV berhasil diantrekan.' });
        setFile(null);
        document.getElementById('csvFileInput').value = '';
      } else {
        setImportMessage({ type: 'error', text: data.error || 'Gagal mengimpor CSV.' });
      }
    } catch (err) {
      setImportMessage({ type: 'error', text: 'Tidak dapat terhubung ke server.' });
    } finally {
      setUploading(false);
    }
  };

  // Helper to get initials from full name
  const getInitials = (name) =>
    name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const formatRupiah = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);

  const statusLabel = { DRAFT: 'Draf', FINALIZED: 'Selesai', SENT: 'Terkirim', ARCHIVED: 'Diarsipkan' };
  const statusColor = {
    DRAFT: { bg: '#f3f4f6', text: '#4b5563' },
    FINALIZED: { bg: '#fffbeb', text: '#b45309' },
    SENT: { bg: '#f0fdf4', text: '#15803d' },
    ARCHIVED: { bg: '#f3f4f6', text: '#6b7280' },
  };

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <header style={{ backgroundColor: '#0f294a', color: '#fff', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>FORTUNA ENGLISH GLOBAL LEARNING</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Panel Admin HR</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>Ir. Ratna Pongkapadang, M.M</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>HR Manager</div>
          </div>
          <button
            onClick={logout}
            style={{ backgroundColor: 'transparent', border: '1px solid #334155', borderRadius: '6px', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
          >
            Keluar
          </button>
        </div>
      </header>

      <main style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {summaryCards.map((card, idx) => (
            <div key={idx} style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ backgroundColor: card.color, color: card.iconColor, width: '48px', height: '48px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}>
                {card.icon}
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>{card.count}</div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>{card.title}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Employee Directory */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>Direktori Karyawan</h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={openPayslipModal}
                style={{ backgroundColor: '#fff', color: '#0f294a', border: '1px solid #0f294a', borderRadius: '6px', padding: '10px 20px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                + Buat Slip Gaji
              </button>
              <button
                onClick={() => { setShowAddModal(true); setAddMessage({ type: '', text: '' }); }}
                style={{ backgroundColor: '#0f294a', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 20px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                + Tambah Karyawan
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#fdfbf7', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>Nama</th>
                  <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>Jabatan</th>
                  <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>Email</th>
                  <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loadingEmployees ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 24px', textAlign: 'center', color: '#9ca3af' }}>Memuat data karyawan...</td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 24px', textAlign: 'center', color: '#9ca3af' }}>Belum ada karyawan.</td>
                  </tr>
                ) : (
                  employees.map((emp, idx) => (
                    <React.Fragment key={emp.employeeId}>
                      <tr style={{ borderBottom: rowMessage.employeeId === emp.employeeId ? 'none' : (idx !== employees.length - 1 ? '1px solid #e5e7eb' : 'none') }}>
                        <td style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 'bold', fontSize: '12px', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {getInitials(emp.fullName)}
                          </div>
                          <span style={{ fontWeight: '600', color: '#1f2937' }}>{emp.fullName}</span>
                        </td>
                        <td style={{ padding: '16px 24px', color: '#4b5563', fontSize: '14px' }}>{emp.jobTitle}</td>
                        <td style={{ padding: '16px 24px', color: '#1f2937', fontSize: '13px', fontWeight: '500' }}>{emp.employmentStatus}</td>
                        <td style={{ padding: '16px 24px', color: '#6b7280', fontSize: '14px' }}>{emp.email}</td>
                        <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            style={{ backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', marginRight: '8px' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(emp)}
                            disabled={deletingId === emp.employeeId}
                            style={{ backgroundColor: '#fff', border: '1px solid #fca5a5', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', fontWeight: '600', color: '#dc2626', cursor: deletingId === emp.employeeId ? 'not-allowed' : 'pointer', opacity: deletingId === emp.employeeId ? 0.6 : 1 }}
                          >
                            {deletingId === emp.employeeId ? 'Menghapus...' : 'Hapus'}
                          </button>
                        </td>
                      </tr>
                      {rowMessage.employeeId === emp.employeeId && (
                        <tr style={{ borderBottom: idx !== employees.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                          <td colSpan={5} style={{ padding: '0 24px 16px' }}>
                            <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '13px', backgroundColor: '#fde8e8', color: '#9b1c1c', border: '1px solid #f8b4b4' }}>
                              {rowMessage.text}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payslip Directory -- serves as HR's send-history checklist:
            was this employee's payslip for this period created, and has
            it actually been handed to them yet? */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>Direktori Slip Gaji</h2>
          </div>

          <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#fdfbf7', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>Karyawan</th>
                  <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>Periode</th>
                  <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>Gaji Bersih</th>
                  <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '14px 24px', fontSize: '12px', fontWeight: '600', color: '#71717a', textTransform: 'uppercase' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loadingPayslips ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 24px', textAlign: 'center', color: '#9ca3af' }}>Memuat data slip gaji...</td>
                  </tr>
                ) : payslips.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 24px', textAlign: 'center', color: '#9ca3af' }}>Belum ada slip gaji.</td>
                  </tr>
                ) : (
                  payslips.map((p, idx) => {
                    const isSent = p.status === 'SENT';
                    const canMarkSent = p.status === 'FINALIZED';
                    return (
                      <React.Fragment key={p.payslipId}>
                        <tr style={{ borderBottom: payslipRowMessage.payslipId === p.payslipId ? 'none' : (idx !== payslips.length - 1 ? '1px solid #e5e7eb' : 'none') }}>
                          <td style={{ padding: '16px 24px', fontWeight: '600', color: '#1f2937' }}>
                            {p.employee?.fullName || '—'}
                            <div style={{ fontWeight: '400', fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{p.employee?.jobTitle}</div>
                          </td>
                          <td style={{ padding: '16px 24px', color: '#4b5563', fontSize: '14px' }}>
                            {monthNames[p.periodMonth - 1]} {p.periodYear}
                          </td>
                          <td style={{ padding: '16px 24px', color: '#1f2937', fontSize: '14px', fontWeight: '600' }}>
                            {formatRupiah(p.netPay)}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{
                              backgroundColor: statusColor[p.status]?.bg || '#f3f4f6',
                              color: statusColor[p.status]?.text || '#4b5563',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}>
                              {statusLabel[p.status] || p.status}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => handleViewPayslip(p)}
                              disabled={viewingId === p.payslipId}
                              title="Lihat / unduh PDF"
                              style={{ backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: viewingId === p.payslipId ? 'not-allowed' : 'pointer', marginRight: '8px', opacity: viewingId === p.payslipId ? 0.6 : 1 }}
                            >
                              {viewingId === p.payslipId ? 'Membuka...' : 'Lihat'}
                            </button>
                            <button
                              onClick={() => handleMarkSent(p)}
                              disabled={isSent || !canMarkSent || markingSentId === p.payslipId}
                              title={isSent ? 'Sudah terkirim ke karyawan' : canMarkSent ? 'Tandai sudah terkirim ke karyawan' : 'Selesaikan slip gaji terlebih dahulu'}
                              style={{
                                backgroundColor: isSent ? '#f0fdf4' : '#fff',
                                border: `1px solid ${isSent ? '#86efac' : '#d1d5db'}`,
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: isSent ? '#15803d' : canMarkSent ? '#374151' : '#9ca3af',
                                cursor: (isSent || !canMarkSent || markingSentId === p.payslipId) ? 'not-allowed' : 'pointer',
                                opacity: markingSentId === p.payslipId ? 0.6 : 1,
                              }}
                            >
                              {markingSentId === p.payslipId ? '...' : isSent ? '✓ Terkirim' : '✓ Tandai Terkirim'}
                            </button>
                          </td>
                        </tr>
                        {payslipRowMessage.payslipId === p.payslipId && (
                          <tr style={{ borderBottom: idx !== payslips.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                            <td colSpan={5} style={{ padding: '0 24px 16px' }}>
                              <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '13px', backgroundColor: '#fde8e8', color: '#9b1c1c', border: '1px solid #f8b4b4' }}>
                                {payslipRowMessage.text}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bulk CSV Import */}
        <section style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#1e3a5f', marginTop: 0 }}>
            Impor Slip Gaji (CSV)
          </h3>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px', marginTop: 0 }}>
            Unggah file CSV untuk memproses slip gaji secara massal di latar belakang.
          </p>
          <form onSubmit={handleBulkImport} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
            <input
              id="csvFileInput"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
            />
            {importMessage.text && (
              <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '14px', backgroundColor: importMessage.type === 'success' ? '#def7ec' : '#fde8e8', color: importMessage.type === 'success' ? '#03543f' : '#9b1c1c', border: `1px solid ${importMessage.type === 'success' ? '#bcf0da' : '#f8b4b4'}` }}>
                {importMessage.text}
              </div>
            )}
            <button
              type="submit"
              disabled={uploading || !file}
              style={{ backgroundColor: uploading || !file ? '#9ca3af' : '#2563eb', color: '#fff', padding: '10px 16px', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: uploading || !file ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}
            >
              {uploading ? 'Memproses...' : 'Unggah & Impor'}
            </button>
          </form>
        </section>

      </main>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '32px', position: 'relative' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f294a' }}>Tambah Karyawan Baru</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Nama Lengkap <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={addForm.fullName}
                  onChange={e => setAddForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Contoh: Budi Santoso"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Job Title */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Jabatan / Posisi <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={addForm.jobTitle}
                  onChange={e => setAddForm(f => ({ ...f, jobTitle: e.target.value }))}
                  placeholder="Contoh: Software Engineer"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Employment Status */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Status Kepegawaian
                </label>
                <select
                  value={addForm.employmentStatus}
                  onChange={e => setAddForm(f => ({ ...f, employmentStatus: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  <option value="PERMANENT">Tetap</option>
                  <option value="CONTRACT">Kontrak</option>
                  <option value="FREELANCE">Freelance</option>
                  <option value="INTERN">Magang</option>
                </select>
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="nama@perusahaan.co.id"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Bank Account */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  No. Rekening Bank <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={addForm.bankAccountNo}
                  onChange={e => setAddForm(f => ({ ...f, bankAccountNo: e.target.value }))}
                  placeholder="Contoh: 1234567890"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Kata Sandi Portal <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 karakter"
                  required
                  minLength={8}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                  Karyawan akan menggunakan ini untuk login ke portal slip gaji.
                </p>
              </div>

              {/* Feedback message */}
              {addMessage.text && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '14px', backgroundColor: addMessage.type === 'success' ? '#def7ec' : '#fde8e8', color: addMessage.type === 'success' ? '#03543f' : '#9b1c1c', border: `1px solid ${addMessage.type === 'success' ? '#bcf0da' : '#f8b4b4'}` }}>
                  {addMessage.text}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, padding: '11px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff', color: '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '6px', backgroundColor: addLoading ? '#9ca3af' : '#0f294a', color: '#fff', fontWeight: '600', cursor: addLoading ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                >
                  {addLoading ? 'Menyimpan...' : 'Simpan Karyawan'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '32px', position: 'relative' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f294a' }}>Edit Karyawan</h3>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Nama Lengkap <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Job Title */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Jabatan / Posisi <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={editForm.jobTitle}
                  onChange={e => setEditForm(f => ({ ...f, jobTitle: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Employment Status */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Status Kepegawaian
                </label>
                <select
                  value={editForm.employmentStatus}
                  onChange={e => setEditForm(f => ({ ...f, employmentStatus: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  <option value="PERMANENT">Tetap</option>
                  <option value="CONTRACT">Kontrak</option>
                  <option value="FREELANCE">Freelance</option>
                  <option value="INTERN">Magang</option>
                </select>
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Bank Account */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  No. Rekening Bank <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={editForm.bankAccountNo}
                  onChange={e => setEditForm(f => ({ ...f, bankAccountNo: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Feedback message */}
              {editMessage.text && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '14px', backgroundColor: editMessage.type === 'success' ? '#def7ec' : '#fde8e8', color: editMessage.type === 'success' ? '#03543f' : '#9b1c1c', border: `1px solid ${editMessage.type === 'success' ? '#bcf0da' : '#f8b4b4'}` }}>
                  {editMessage.text}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{ flex: 1, padding: '11px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff', color: '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '6px', backgroundColor: editLoading ? '#9ca3af' : '#0f294a', color: '#fff', fontWeight: '600', cursor: editLoading ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                >
                  {editLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Create Payslip ("Buat Slip Gaji") Modal */}
      {showPayslipModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px', overflowY: 'auto' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '560px', padding: '32px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f294a' }}>Buat Slip Gaji</h3>
              <button
                onClick={() => setShowPayslipModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreatePayslip} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Employee */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Karyawan <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={payslipForm.employeeId}
                  onChange={e => setPayslipForm(f => ({ ...f, employeeId: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  <option value="" disabled>Pilih karyawan...</option>
                  {employees.map(emp => (
                    <option key={emp.employeeId} value={emp.employeeId}>{emp.fullName} — {emp.jobTitle}</option>
                  ))}
                </select>
              </div>

              {/* Period Month / Year */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Bulan <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={payslipForm.periodMonth}
                    onChange={e => setPayslipForm(f => ({ ...f, periodMonth: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff' }}
                  >
                    {monthNames.map((name, idx) => (
                      <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Tahun <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={payslipForm.periodYear}
                    onChange={e => setPayslipForm(f => ({ ...f, periodYear: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Issue Date / Location */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Tanggal Terbit <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={payslipForm.issueDate}
                    onChange={e => setPayslipForm(f => ({ ...f, issueDate: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Lokasi Terbit
                  </label>
                  <input
                    type="text"
                    value={payslipForm.issueLocation}
                    onChange={e => setPayslipForm(f => ({ ...f, issueLocation: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Basic Salary */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Gaji Pokok <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={payslipForm.basicSalary}
                  onChange={e => setPayslipForm(f => ({ ...f, basicSalary: e.target.value }))}
                  placeholder="Contoh: 5000000"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Earnings (dynamic rows) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Tunjangan / Bonus (opsional)</label>
                  <button type="button" onClick={addEarningRow} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Tambah</button>
                </div>
                {payslipForm.earnings.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={row.label}
                      onChange={e => updateEarningRow(idx, 'label', e.target.value)}
                      placeholder="Label, cth: Tunjangan Transport"
                      style={{ flex: 2, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                    <select
                      value={row.category}
                      onChange={e => updateEarningRow(idx, 'category', e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', backgroundColor: '#fff' }}
                    >
                      <option value="ALLOWANCE">Tunjangan</option>
                      <option value="BONUS">Bonus</option>
                      <option value="OVERTIME">Lembur</option>
                      <option value="INCENTIVE">Insentif</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={row.amount}
                      onChange={e => updateEarningRow(idx, 'amount', e.target.value)}
                      placeholder="Jumlah"
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                    <button type="button" onClick={() => removeEarningRow(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '16px', cursor: 'pointer', padding: '0 4px' }}>×</button>
                  </div>
                ))}
              </div>

              {/* Deductions (dynamic rows) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Potongan (opsional)</label>
                  <button type="button" onClick={addDeductionRow} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Tambah</button>
                </div>
                {payslipForm.deductions.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={row.label}
                      onChange={e => updateDeductionRow(idx, 'label', e.target.value)}
                      placeholder="Label, cth: BPJS Kesehatan"
                      style={{ flex: 2, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                    <select
                      value={row.category}
                      onChange={e => updateDeductionRow(idx, 'category', e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', backgroundColor: '#fff' }}
                    >
                      <option value="BPJS_HEALTH">BPJS Kesehatan</option>
                      <option value="BPJS_PENSION">BPJS Pensiun</option>
                      <option value="PPH21_TAX">PPh21</option>
                      <option value="ABSENCE_PENALTY">Potongan Absensi</option>
                      <option value="SALARY_ADVANCE">Kasbon</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={row.amount}
                      onChange={e => updateDeductionRow(idx, 'amount', e.target.value)}
                      placeholder="Jumlah"
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                    <button type="button" onClick={() => removeDeductionRow(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '16px', cursor: 'pointer', padding: '0 4px' }}>×</button>
                  </div>
                ))}
              </div>

              {/* Authorized Signatory */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Penandatangan <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={payslipForm.authorizedSignatory}
                  onChange={e => setPayslipForm(f => ({ ...f, authorizedSignatory: e.target.value }))}
                  placeholder="Contoh: Ir. Ratna Pongkapadang, M.M"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Feedback message */}
              {payslipMessage.text && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '14px', backgroundColor: payslipMessage.type === 'success' ? '#def7ec' : '#fde8e8', color: payslipMessage.type === 'success' ? '#03543f' : '#9b1c1c', border: `1px solid ${payslipMessage.type === 'success' ? '#bcf0da' : '#f8b4b4'}` }}>
                  {payslipMessage.text}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowPayslipModal(false)}
                  style={{ flex: 1, padding: '11px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff', color: '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={payslipLoading}
                  style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '6px', backgroundColor: payslipLoading ? '#9ca3af' : '#0f294a', color: '#fff', fontWeight: '600', cursor: payslipLoading ? 'not-allowed' : 'pointer', fontSize: '14px' }}
                >
                  {payslipLoading ? 'Menyimpan...' : 'Buat Slip Gaji'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
