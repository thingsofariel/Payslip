// src/config/prisma.js
//
// Singleton PrismaClient instance, shared across the whole app.
// Uses the @prisma/adapter-pg pattern — this matches what's already
// verified working in prisma/seed.js. Do NOT switch back to bare
// `new PrismaClient()` — Prisma 7.8.0 requires the adapter when the
// connection URL lives in prisma.config.ts rather than schema.prisma.

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
