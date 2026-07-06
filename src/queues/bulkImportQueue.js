// src/queues/bulkImportQueue.js
//
// Shared Queue DEFINITION (name + job options) used by both the API
// process (producer) and the worker process (consumer). The actual
// Redis CONNECTION is deliberately NOT shared between them -- see the
// comment below for why.

const { Queue } = require('bullmq');
const IORedis = require('ioredis');
require('dotenv').config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// PRODUCER connection (used here, by the API process, to enqueue jobs).
// Deliberately configured to FAIL FAST if Redis is unreachable, rather
// than hanging the HTTP request indefinitely:
//   - maxRetriesPerRequest: 1 -- don't retry forever; surface an error
//     quickly so the admin's upload request returns promptly with a
//     clear failure rather than spinning.
//   - enableOfflineQueue: false -- don't silently buffer commands while
//     disconnected; fail the .add() call instead.
//
// This is the opposite of what a Worker needs (which should patiently
// retry in the background -- see src/workers/bulkImportWorker.js for
// its own, separately-configured connection). Sharing one connection
// object across both roles is a documented BullMQ footgun: it forces
// one role's correct behavior onto the other.
const producerConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

const BULK_IMPORT_QUEUE_NAME = 'bulk-payslip-import';

const bulkImportQueue = new Queue(BULK_IMPORT_QUEUE_NAME, {
  connection: producerConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    // Keep a bounded history rather than letting completed/failed jobs
    // accumulate in Redis forever -- this is a known BullMQ footgun if
    // left unset (memory grows unbounded over time).
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

module.exports = { bulkImportQueue, BULK_IMPORT_QUEUE_NAME, REDIS_URL };
