 // src/theme.js
//
// Shared design tokens, carried over from the visual mockup so the
// real app and the PDF template feel like one product.

export const palette = {
  navy: '#1a3a5c',
  navyDark: '#142d49',
  paper: '#faf8f4',
  paperDeep: '#f2eee4',
  charcoal: '#2a2a2a',
  gold: '#c9a04e',
  sage: '#7a9b7a',
  rust: '#a8554a',
  line: '#e0dccf',
  muted: '#8a8478',
};

export const fonts = {
  display: "'Source Serif 4', Georgia, serif",
  body: "'Inter', sans-serif",
};

export function formatIDR(amount) {
  const value = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  return 'Rp ' + value.toLocaleString('id-ID', { minimumFractionDigits: 0 });
}

export function formatDateID(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function monthName(monthNumber) {
  return MONTH_NAMES_ID[monthNumber - 1] || String(monthNumber);
}
