// src/controllers/payslipController.js

const prisma = require('../config/prisma');
const { generatePayslipPdf } = require('../services/pdfService');

/**
 * GET /api/payslips
 * - ADMIN_HR: sees all payslips (optionally filtered by ?employeeId=)
 * - EMPLOYEE: sees only their own payslips, regardless of query params.
 *
 * This is the critical RBAC enforcement point: an employee's identity
 * comes from req.user.employeeId (set by the authenticate middleware
 * from the verified JWT), never from a client-supplied parameter.
 * Otherwise an employee could pass ?employeeId=5 and read someone
 * else's payroll data.
 */
async function listPayslips(req, res) {
  try {
    const where = {};

    if (req.user.role === 'EMPLOYEE') {
      where.employeeId = req.user.employeeId;
    } else if (req.query.employeeId) {
      // ADMIN_HR may filter by a specific employee
      where.employeeId = parseInt(req.query.employeeId, 10);
    }

    if (req.query.year) {
      where.periodYear = parseInt(req.query.year, 10);
    }
    if (req.query.month) {
      where.periodMonth = parseInt(req.query.month, 10);
    }

    const payslips = await prisma.payslip.findMany({
      where,
      include: {
        employee: {
          select: { fullName: true, jobTitle: true, employeeId: true },
        },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });

    return res.json({ payslips });
  } catch (err) {
    console.error('listPayslips error:', err);
    return res.status(500).json({ error: 'Failed to retrieve payslips.' });
  }
}

/**
 * GET /api/payslips/:id
 * Same ownership rule as above, enforced per-record rather than via
 * a list filter — an employee cannot fetch someone else's payslip by
 * guessing/incrementing the ID.
 */
async function getPayslipById(req, res) {
  try {
    const payslipId = parseInt(req.params.id, 10);

    const payslip = await prisma.payslip.findUnique({
      where: { payslipId },
      include: {
        employee: true,
        earningDetails: { orderBy: { sortOrder: 'asc' } },
        deductionDetails: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found.' });
    }

    const isOwner = payslip.employeeId === req.user.employeeId;
    const isAdmin = req.user.role === 'ADMIN_HR';

    if (!isOwner && !isAdmin) {
      // 404, not 403 — don't reveal that a payslip with this ID exists
      // at all to someone who has no right to see it.
      return res.status(404).json({ error: 'Payslip not found.' });
    }

    return res.json({ payslip });
  } catch (err) {
    console.error('getPayslipById error:', err);
    return res.status(500).json({ error: 'Failed to retrieve payslip.' });
  }
}

/**
 * POST /api/payslips
 * ADMIN_HR only (enforced by route-level authorize() middleware).
 * Creates a payslip header plus its earning/deduction line items in
 * a single transaction — either all the data is written, or none of
 * it is. The DB trigger (recalc_payslip_totals) fires automatically
 * once the line items are inserted, so we don't compute totals here.
 */
async function createPayslip(req, res) {
  const {
    employeeId,
    periodMonth,
    periodYear,
    issueDate,
    issueLocation,
    basicSalary,
    authorizedSignatory,
    earnings = [],
    deductions = [],
  } = req.body;

  if (!employeeId || !periodMonth || !periodYear || !issueDate || !authorizedSignatory) {
    return res.status(400).json({
      error: 'employeeId, periodMonth, periodYear, issueDate, and authorizedSignatory are required.',
    });
  }

  try {
    const payslip = await prisma.$transaction(async (tx) => {
      const created = await tx.payslip.create({
        data: {
          employeeId,
          periodMonth,
          periodYear,
          issueDate: new Date(issueDate),
          issueLocation: issueLocation || 'Kupang',
          basicSalary,
          authorizedSignatory,
          status: 'DRAFT',
        },
      });

      if (earnings.length > 0) {
        await tx.earningDetail.createMany({
          data: earnings.map((e, idx) => ({
            payslipId: created.payslipId,
            label: e.label,
            category: e.category || 'ALLOWANCE',
            amount: e.amount,
            sortOrder: idx,
          })),
        });
      }

      if (deductions.length > 0) {
        await tx.deductionDetail.createMany({
          data: deductions.map((d, idx) => ({
            payslipId: created.payslipId,
            label: d.label,
            category: d.category || 'OTHER',
            amount: d.amount,
            sortOrder: idx,
          })),
        });
      }

      // Re-fetch so the response includes the trigger-calculated totals,
      // not the stale zero-value totals from the initial insert.
      return tx.payslip.findUnique({
        where: { payslipId: created.payslipId },
        include: { earningDetails: true, deductionDetails: true },
      });
    });

    await prisma.auditLog.create({
      data: {
        payslipId: payslip.payslipId,
        actorId: req.user.employeeId,
        action: 'CREATE',
        detail: `Payslip created for employee ${employeeId}, period ${periodMonth}/${periodYear}`,
      },
    });

    return res.status(201).json({ payslip });
  } catch (err) {
    if (err.code === 'P2002') {
      // Unique constraint violation — duplicate (employeeId, month, year)
      return res.status(409).json({
        error: 'A payslip for this employee and period already exists.',
      });
    }
    console.error('createPayslip error:', err);
    return res.status(500).json({ error: 'Failed to create payslip.' });
  }
}

/**
 * PATCH /api/payslips/:id/finalize
 * ADMIN_HR only. Transitions a payslip from DRAFT to FINALIZED.
 * This is the trigger point that will, in a future step, kick off the
 * PDF generation + mailer job — kept as a placeholder for now.
 */
async function finalizePayslip(req, res) {
  try {
    const payslipId = parseInt(req.params.id, 10);

    const payslip = await prisma.payslip.findUnique({
      where: { payslipId },
      include: {
        employee: true,
        earningDetails: { orderBy: { sortOrder: 'asc' } },
        deductionDetails: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found.' });
    }

    if (payslip.status !== 'DRAFT') {
      return res.status(400).json({
        error: `Cannot finalize a payslip with status "${payslip.status}". Only DRAFT payslips can be finalized.`,
      });
    }

    // Generate the PDF BEFORE flipping status to FINALIZED, so that if
    // PDF generation throws (e.g. Puppeteer/qpdf misconfigured on this
    // host), the payslip stays in DRAFT rather than being marked
    // FINALIZED with no corresponding document. The status update and
    // the audit log entry then happen together once we know the PDF
    // actually exists.
    const { filePath, verificationHash } = await generatePayslipPdf(payslip);

    const updated = await prisma.payslip.update({
      where: { payslipId },
      data: {
        status: 'FINALIZED',
        pdfPath: filePath,
        pdfGeneratedAt: new Date(),
        verificationHash,
      },
    });

    await prisma.auditLog.create({
      data: {
        payslipId,
        actorId: req.user.employeeId,
        action: 'FINALIZE',
        detail: 'Payslip finalized and PDF generated.',
      },
    });

    // TODO: enqueue the mailer job here once the BullMQ mailer service
    // exists, so the employee is notified automatically. Left as a
    // separate build step per the roadmap -- not done in this pass.

    return res.json({ payslip: updated });
  } catch (err) {
    console.error('finalizePayslip error:', err);
    return res.status(500).json({ error: 'Failed to finalize payslip.' });
  }
}

/**
 * PATCH /api/payslips/:id/mark-sent
 * ADMIN_HR only. Transitions a payslip from FINALIZED to SENT.
 *
 * This is a manual confirmation step -- there is no automatic mailer yet
 * (see roadmap), so this simply lets HR record "I have actually handed
 * this payslip to the employee" (however that happened: email, WhatsApp,
 * printed copy) so the payslip directory can serve as a send-history
 * checklist rather than just a creation log.
 */
async function markPayslipSent(req, res) {
  try {
    const payslipId = parseInt(req.params.id, 10);

    const payslip = await prisma.payslip.findUnique({ where: { payslipId } });

    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found.' });
    }

    if (payslip.status !== 'FINALIZED') {
      return res.status(400).json({
        error: `Cannot mark as sent -- payslip status is "${payslip.status}". Only FINALIZED payslips can be marked as sent.`,
      });
    }

    const updated = await prisma.payslip.update({
      where: { payslipId },
      data: { status: 'SENT' },
    });

    await prisma.auditLog.create({
      data: {
        payslipId,
        actorId: req.user.employeeId,
        action: 'MARK_SENT',
        detail: 'Payslip manually marked as sent to employee.',
      },
    });

    return res.json({ payslip: updated });
  } catch (err) {
    console.error('markPayslipSent error:', err);
    return res.status(500).json({ error: 'Failed to mark payslip as sent.' });
  }
}

module.exports = {
  listPayslips,
  getPayslipById,
  createPayslip,
  finalizePayslip,
  markPayslipSent,
};
