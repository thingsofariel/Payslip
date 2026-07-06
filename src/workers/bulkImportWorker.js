// src/workers/bulkImportWorker.js
//
// Standalone worker process. Run this with its OWN `node` invocation,
// separate from src/server.js -- NOT required/imported by the API
// server. Per BullMQ's own production guidance: if the worker runs
// inside the API process, a worker crash takes the API down with it.
// Two separate processes means a stuck or crashed worker never
// affects whether the API can still serve logins, payslip reads, etc.
//
// Run with: node src/workers/bulkImportWorker.js
// (In production, this would run as its own systemd service / Docker
// container / pm2 process -- for local dev, just run it in its own
// terminal tab alongside `npm run dev`.)

const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { BULK_IMPORT_QUEUE_NAME, REDIS_URL } = require('../queues/bulkImportQueue');
const prisma = require('../config/prisma');

// CONSUMER connection -- separate from the producer connection used by
// the API process (src/queues/bulkImportQueue.js). Workers should be
// patient and keep retrying in the background if Redis blips, rather
// than failing fast like an HTTP-facing producer should.
//   - maxRetriesPerRequest: null is REQUIRED by BullMQ for Workers --
//     they use blocking Redis commands (BLPOP) internally, and ioredis
//     throws if a max retry count is set on those.
const workerConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

/**
 * Processes a single payslip-creation job. Mirrors the same
 * transaction logic as payslipController.js's createPayslip, so a
 * bulk-imported payslip and a manually-created one go through
 * identical validation and DB writes -- there is exactly one code
 * path for "what does creating a payslip mean," not two that could
 * drift apart over time.
 */
async function processImportJob(job) {
  const { employeeId, periodMonth, periodYear, issueDate, issueLocation, basicSalary, authorizedSignatory, earnings, deductions, actorId } = job.data;

  // Re-validate employeeId exists -- the CSV could reference an
  // employeeId that looked numeric but doesn't correspond to a real
  // row, and this is the first point with actual DB access to check.
  const employeeExists = await prisma.employee.findUnique({ where: { employeeId } });
  if (!employeeExists) {
    throw new Error(`employeeId ${employeeId} does not exist.`);
  }

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
          category: 'ALLOWANCE',
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
          category: 'OTHER',
          amount: d.amount,
          sortOrder: idx,
        })),
      });
    }

    return created;
  });

  await prisma.auditLog.create({
    data: {
      payslipId: payslip.payslipId,
      actorId,
      action: 'CREATE',
      detail: `Created via bulk CSV import (job ${job.id}).`,
    },
  });

  return { payslipId: payslip.payslipId, employeeId };
}

const worker = new Worker(BULK_IMPORT_QUEUE_NAME, processImportJob, {
  connection: workerConnection,
  concurrency: 5,
});

worker.on('completed', (job, result) => {
  console.log(`[bulk-import worker] Job ${job.id} completed -- created payslip ${result.payslipId}`);
});

worker.on('failed', (job, err) => {
  console.error(`[bulk-import worker] Job ${job?.id} failed:`, err.message);
});

console.log('Bulk import worker started, listening on queue:', BULK_IMPORT_QUEUE_NAME);

// Graceful shutdown -- without this, killing the worker process mid-job
// can leave a job stuck in a half-processed state.
process.on('SIGTERM', async () => {
  console.log('Worker shutting down...');
  await worker.close();
  await workerConnection.quit();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('Worker shutting down...');
  await worker.close();
  await workerConnection.quit();
  process.exit(0);
});
