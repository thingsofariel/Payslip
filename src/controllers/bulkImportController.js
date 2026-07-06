// src/controllers/bulkImportController.js

const { parseAndValidateCsv } = require('../services/csvImportService');
const { bulkImportQueue } = require('../queues/bulkImportQueue');
const prisma = require('../config/prisma');

/**
 * POST /api/payslips/bulk-import
 * ADMIN_HR only. Expects a multipart/form-data upload with a single
 * file field named "file" (CSV).
 *
 * Validation happens synchronously here, BEFORE anything is enqueued.
 * This means a CSV with bad rows gets rejected immediately with a
 * full list of every problem, rather than the admin discovering
 * failures one at a time as jobs trickle through the queue over the
 * next several minutes.
 *
 * Valid rows are enqueued individually -- one bad row does not block
 * or fail the other valid rows in the same file.
 */
async function bulkImportPayslips(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Expected a CSV file in the "file" field.' });
  }

  const csvText = req.file.buffer.toString('utf-8');

  let parsedRows;
  try {
    parsedRows = parseAndValidateCsv(csvText);
  } catch (err) {
    // This catches structural problems (missing columns, unparseable
    // CSV) that make the whole file unusable, as distinct from
    // per-row validation errors below.
    return res.status(400).json({ error: err.message });
  }

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const invalidRows = parsedRows.filter((r) => r.errors.length > 0);

  if (validRows.length === 0) {
    return res.status(400).json({
      error: 'No valid rows found in the CSV.',
      invalidRows: invalidRows.map((r) => ({ row: r.rowNumber, errors: r.errors })),
    });
  }

  // Generate a batch ID up front so the response can immediately tell
  // the admin how to poll for status, even though jobs are still
  // being enqueued below.
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const jobs = await Promise.all(
    validRows.map((row) =>
      bulkImportQueue.add(
        'import-row',
        {
          employeeId: Number(row.data.employeeId),
          periodMonth: Number(row.data.periodMonth),
          periodYear: Number(row.data.periodYear),
          issueDate: row.data.issueDate,
          issueLocation: row.data.issueLocation || 'Kupang',
          basicSalary: Number(row.data.basicSalary),
          authorizedSignatory: row.data.authorizedSignatory,
          earnings: row.earnings,
          deductions: row.deductions,
          actorId: req.user.employeeId,
          batchId,
          sourceRowNumber: row.rowNumber,
        },
        {
          // jobId scoped to this batch + row keeps job IDs unique across
          // concurrent imports without the caller needing to manage that.
          jobId: `${batchId}-row-${row.rowNumber}`,
        }
      )
    )
  );

  return res.status(202).json({
    batchId,
    queuedCount: jobs.length,
    skippedCount: invalidRows.length,
    invalidRows: invalidRows.map((r) => ({ row: r.rowNumber, errors: r.errors })),
    message: `${jobs.length} row(s) queued for processing. Poll /api/payslips/bulk-import/${batchId}/status for progress.`,
  });
}

/**
 * GET /api/payslips/bulk-import/:batchId/status
 * ADMIN_HR only. Polls the queue for jobs belonging to this batch and
 * reports how many have completed, failed, or are still pending.
 *
 * This is a simple polling implementation -- BullMQ jobIds are scoped
 * by batchId (see jobId above), so we can look each one up directly
 * rather than needing a separate index of "which jobs belong to which
 * batch."
 */
async function getBulkImportStatus(req, res) {
  const { batchId } = req.params;

  // We don't have a stored count of how many jobs were originally
  // queued for this batchId beyond what the client remembers from the
  // initial 202 response, so this endpoint reports on whatever jobs
  // it can find under this batchId prefix rather than a fixed total.
  const jobCounts = await bulkImportQueue.getJobCounts();

  // Fetch up to a reasonable number of jobs across each state and
  // filter to this batch -- BullMQ doesn't index by arbitrary data
  // fields natively, so this is a practical compromise for a feature
  // at this scale rather than something built for thousands of
  // concurrent batches.
  const [completed, failed, active, waiting] = await Promise.all([
    bulkImportQueue.getJobs(['completed'], 0, 500),
    bulkImportQueue.getJobs(['failed'], 0, 500),
    bulkImportQueue.getJobs(['active'], 0, 500),
    bulkImportQueue.getJobs(['waiting'], 0, 500),
  ]);

  const matchesBatch = (job) => job.data.batchId === batchId;

  const completedForBatch = completed.filter(matchesBatch);
  const failedForBatch = failed.filter(matchesBatch);
  const activeForBatch = active.filter(matchesBatch);
  const waitingForBatch = waiting.filter(matchesBatch);

  const total = completedForBatch.length + failedForBatch.length + activeForBatch.length + waitingForBatch.length;

  if (total === 0) {
    return res.status(404).json({ error: 'No jobs found for this batch ID.' });
  }

  return res.json({
    batchId,
    total,
    completed: completedForBatch.length,
    failed: failedForBatch.length,
    active: activeForBatch.length,
    waiting: waitingForBatch.length,
    isDone: activeForBatch.length === 0 && waitingForBatch.length === 0,
    failures: failedForBatch.map((j) => ({
      row: j.data.sourceRowNumber,
      employeeId: j.data.employeeId,
      reason: j.failedReason,
    })),
  });
}

module.exports = { bulkImportPayslips, getBulkImportStatus };
