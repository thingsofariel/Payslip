// prisma/seed.js
//
// Seeds sample data matching the structure of the physical payslip form.
// Run with: npx prisma db seed
// (after adding to package.json: "prisma": { "seed": "node prisma/seed.js" })

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- 1. HR Admin user ---
  const hrAdmin = await prisma.employee.create({
    data: {
      fullName: 'Ir. Ratna Pongkapadang, M.M',
      jobTitle: 'HR Manager',
      employmentStatus: 'PERMANENT',
      email: 'ratna.pongkapadang@company.co.id',
      bankAccountNo: '1234567890',
      passwordHash: await bcrypt.hash('changeme123', 10),
      role: 'ADMIN_HR',
    },
  });

  // --- 2. Regular employee ---
  const employee = await prisma.employee.create({
    data: {
      fullName: 'Budi Santoso',
      jobTitle: 'Software Engineer',
      employmentStatus: 'PERMANENT',
      email: 'budi.santoso@company.co.id',
      bankAccountNo: '9876543210',
      nik: '5371234567890001',
      dateOfBirth: new Date('1995-03-14'),
      passwordHash: await bcrypt.hash('changeme123', 10),
      role: 'EMPLOYEE',
    },
  });

  // --- 3. Payslip header for June 2026 ---
  const payslip = await prisma.payslip.create({
    data: {
      employeeId: employee.employeeId,
      periodMonth: 6,
      periodYear: 2026,
      issueDate: new Date('2026-06-27'),
      issueLocation: 'Kupang',
      basicSalary: 8000000,
      authorizedSignatory: hrAdmin.fullName,
      status: 'DRAFT',
    },
  });

  // --- 4. Earnings (dynamic line items) ---
  await prisma.earningDetail.createMany({
    data: [
      { payslipId: payslip.payslipId, label: 'Transport Allowance', category: 'ALLOWANCE', amount: 500000, sortOrder: 1 },
      { payslipId: payslip.payslipId, label: 'Meal Allowance', category: 'ALLOWANCE', amount: 400000, sortOrder: 2 },
      { payslipId: payslip.payslipId, label: 'Overtime (4 hrs)', category: 'OVERTIME', amount: 250000, sortOrder: 3 },
    ],
  });

  // --- 5. Deductions (dynamic line items) ---
  await prisma.deductionDetail.createMany({
    data: [
      { payslipId: payslip.payslipId, label: 'BPJS Kesehatan', category: 'BPJS_HEALTH', amount: 80000, sortOrder: 1 },
      { payslipId: payslip.payslipId, label: 'BPJS Pensiun', category: 'BPJS_PENSION', amount: 60000, sortOrder: 2 },
      { payslipId: payslip.payslipId, label: 'PPh21', category: 'PPH21_TAX', amount: 350000, sortOrder: 3 },
    ],
  });

  // --- 6. Audit trail entry ---
  await prisma.auditLog.create({
    data: {
      payslipId: payslip.payslipId,
      actorId: hrAdmin.employeeId,
      action: 'CREATE',
      detail: 'Payslip drafted for period 06/2026',
    },
  });

  // --- 7. Read back with totals (verifies trigger ran) ---
  const result = await prisma.payslip.findUnique({
    where: { payslipId: payslip.payslipId },
    include: { earningDetails: true, deductionDetails: true, employee: true },
  });

  console.log('--- Seed complete ---');
  console.log(`Employee: ${result.employee.fullName} (${result.employee.jobTitle})`);
  console.log(`Period: ${result.periodMonth}/${result.periodYear}`);
  console.log(`Basic Salary: ${result.basicSalary}`);
  console.log(`Total Earnings (incl. basic): ${result.totalEarnings}`);
  console.log(`Total Deductions: ${result.totalDeductions}`);
  console.log(`Net Pay: ${result.netPay}`);
  // Expected: basic 8,000,000 + 1,150,000 earnings - 490,000 deductions = 8,660,000
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
