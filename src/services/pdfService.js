// src/services/pdfService.js
//
// Renders a payslip record into a PDF using Puppeteer (HTML -> PDF),
// applies owner-password protection, and embeds a verification QR code.
//
// IMPORTANT: this file was written and syntax-checked, but could not be
// run end-to-end in the authoring sandbox -- there is no Chromium binary
// and no network access there to install one. Puppeteer launching a real
// headless Chrome process is something only your environment can verify.
// Treat the first real run the same way we treated `prisma migrate dev`
// earlier: expect to debug something on the first attempt, and that's
// normal, not a sign anything is fundamentally wrong.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');
const { encrypt: qpdfEncrypt } = require('node-qpdf2');

require('dotenv').config();

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'payslip.html');
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'payslip-pdfs');

const COMPANY_NAME = process.env.COMPANY_NAME || 'PT Contoh Sejahtera';
const COMPANY_TAGLINE = process.env.COMPANY_TAGLINE || 'Jl. Contoh No. 1, Kupang, NTT';

// Indonesian month names for the period label (e.g. "Juni 2026")
const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatIDR(amount) {
  // Prisma returns Decimal fields as strings in JS -- coerce explicitly.
  const value = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  return 'Rp ' + value.toLocaleString('id-ID', { minimumFractionDigits: 0 });
}

function formatDateID(date) {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Builds the HMAC-SHA256 verification hash for a payslip.
 * This is tamper-evidence, not a way to encode payroll data -- the QR
 * code only carries a lookup token, never the actual figures. Anyone
 * scanning it should hit a server-side verification endpoint, not
 * decode embedded salary data from the QR payload itself.
 */
function buildVerificationHash(payslip) {
  const secret = process.env.HASH_SECRET;
  if (!secret) {
    throw new Error('HASH_SECRET is not set in .env -- cannot generate a verification hash.');
  }
  const payload = `${payslip.payslipId}:${payslip.netPay}:${payslip.issueDate}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Renders the line-item rows (earnings or deductions) into <tr> HTML.
 * Kept as a small helper so the main render function stays readable.
 */
function renderLineItemRows(items) {
  if (!items || items.length === 0) {
    return '';
  }
  return items
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      <td class="amount">${formatIDR(item.amount)}</td>
    </tr>`
    )
    .join('');
}

/**
 * Minimal HTML-escaping for user-supplied labels (e.g. "Transport
 * Allowance") so a stray "<" or "&" in a label can't break the layout
 * or, worse, inject markup into a generated PDF.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fills the HTML template with data from a fully-loaded payslip record.
 * `payslip` is expected to include `employee`, `earningDetails`, and
 * `deductionDetails` (i.e. the same shape returned by
 * prisma.payslip.findUnique({ include: {...} }) in payslipController.js).
 */
async function renderTemplate(payslip) {
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  const verificationHash = payslip.verificationHash || buildVerificationHash(payslip);

  // The QR code points at a verification URL, not raw payroll data.
  // BASE_URL should be set in .env once a real domain exists; falls
  // back to localhost for local development.
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/api/payslips/verify/${verificationHash}`;
  const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1 });

  const periodLabel = `${MONTH_NAMES_ID[payslip.periodMonth - 1]} ${payslip.periodYear}`;

  const replacements = {
    companyName: escapeHtml(COMPANY_NAME),
    companyTagline: escapeHtml(COMPANY_TAGLINE),
    periodLabel,
    fullName: escapeHtml(payslip.employee.fullName),
    bankAccountNo: escapeHtml(payslip.employee.bankAccountNo),
    jobTitle: escapeHtml(payslip.employee.jobTitle),
    employmentStatus: escapeHtml(payslip.employee.employmentStatus),
    basicSalaryFormatted: formatIDR(payslip.basicSalary),
    earningRows: renderLineItemRows(payslip.earningDetails),
    totalEarningsFormatted: formatIDR(payslip.totalEarnings),
    deductionRows: renderLineItemRows(payslip.deductionDetails),
    totalDeductionsFormatted: formatIDR(payslip.totalDeductions),
    netPayFormatted: formatIDR(payslip.netPay),
    issueLocation: escapeHtml(payslip.issueLocation),
    issueDateFormatted: formatDateID(payslip.issueDate),
    authorizedSignatory: escapeHtml(payslip.authorizedSignatory),
    qrCodeDataUrl,
    verificationHash,
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  return { html, verificationHash };
}

/**
 * Generates a password to encrypt the PDF, derived from the employee's
 * date of birth and NIK (last 4 digits), per the original spec.
 *
 * SECURITY NOTE (flagged in the original system design too): this is
 * weak protection in practice. An employee's DOB and NIK are not secret
 * -- NIK in particular is printed on the physical KTP and shared with
 * banks routinely. Treat this as a deterrent against casual snooping
 * of an email attachment, not real encryption. The actual access
 * control is the authenticated API endpoint in front of this file.
 */
function derivePdfPassword(employee) {
  if (!employee.dateOfBirth || !employee.nik) {
    // Fall back to NIK-only or a fixed pattern if DOB isn't on file --
    // but surface this clearly rather than silently producing a weak
    // or empty password.
    throw new Error(
      `Cannot derive PDF password for employee ${employee.employeeId}: dateOfBirth and/or nik is missing.`
    );
  }
  const dob = new Date(employee.dateOfBirth);
  const ddmmyyyy =
    String(dob.getDate()).padStart(2, '0') +
    String(dob.getMonth() + 1).padStart(2, '0') +
    dob.getFullYear();
  const nikLast4 = employee.nik.slice(-4);
  return `${ddmmyyyy}${nikLast4}`;
}

/**
 * Encrypts an existing PDF file with an owner password, using the
 * `qpdf` command-line tool under the hood via the node-qpdf2 wrapper.
 *
 * REQUIRES qpdf TO BE INSTALLED ON THE HOST -- this is a system package,
 * not something `npm install` provides on its own:
 *   Debian/Ubuntu: sudo apt install qpdf
 *   macOS:         brew install qpdf
 * `npm install node-qpdf2` only installs the JS wrapper; it shells out
 * to the real `qpdf` binary, which must already be on PATH.
 */
async function encryptPdfWithPassword(inputPath, outputPath, ownerPassword) {
  await qpdfEncrypt({
    input: inputPath,
    output: outputPath,
    password: ownerPassword,
    keyLength: 256,
    restrictions: { useAes: 'y' },
  });
}

/**
 * Main entry point: generates a finished, password-protected PDF for a
 * payslip and writes it to disk. Returns the absolute file path.
 *
 * `payslip` must be the fully-loaded Prisma record (with employee,
 * earningDetails, deductionDetails included).
 */
async function generatePayslipPdf(payslip) {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  const { html, verificationHash } = await renderTemplate(payslip);

  const unencryptedPath = path.join(STORAGE_DIR, `payslip-${payslip.payslipId}-raw.pdf`);
  const finalPath = path.join(STORAGE_DIR, `payslip-${payslip.payslipId}.pdf`);

  const browser = await puppeteer.launch({
    headless: true,
    // --no-sandbox is commonly required in containerized/CI environments
    // where the default Chrome sandbox can't initialize. If you're
    // running this on a normal desktop Linux session (not Docker), you
    // can likely remove these two flags -- test both ways if PDF
    // generation fails with a sandbox-related error.
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: unencryptedPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
  } finally {
    await browser.close();
  }

  const password = derivePdfPassword(payslip.employee);
  await encryptPdfWithPassword(unencryptedPath, finalPath, password);

  // Remove the unencrypted intermediate file -- it should never persist
  // on disk even briefly longer than necessary.
  fs.unlinkSync(unencryptedPath);

  return { filePath: finalPath, verificationHash };
}

module.exports = {
  generatePayslipPdf,
  buildVerificationHash,
  derivePdfPassword,
};
