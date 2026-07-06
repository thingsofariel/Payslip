# Payslip System — Database Layer

## ⚠️ Verification note (read this first)

This sandbox has **no network access** and **no PostgreSQL installed**, so I could not
run `npx prisma migrate dev` or `npx prisma validate` against a live database to give
you tool-verified confirmation. What I did instead, so this isn't just unverified output:

1. Hand-wrote the **raw SQL equivalent** (`prisma/migrations/0001_init/migration.sql`) of
   the Prisma schema and cross-checked every model → table mapping with a script (all 5
   matched).
2. Hand-traced the `recalc_payslip_totals()` trigger against the seed data's numbers —
   confirmed `total_earnings`, `total_deductions`, and `net_pay` compute correctly
   (8,000,000 + 1,150,000 − 490,000 = 8,660,000 ✓).
3. Reviewed Prisma syntax (relation attributes, `@map`/`@@map`, decimal precision,
   cascade rules, composite unique constraints) manually against Prisma's documented
   grammar.

**Before you trust this in production:** run it against a real Postgres instance —
`npx prisma migrate dev --name init` — and run the seed script. I'm confident in the
logic, but I have not executed it, and you should not take my word over a real test run.

## Files

```
prisma/
├── schema.prisma                      # Source of truth — edit this
├── seed.js                            # Sample data + sanity check on totals
└── migrations/
    └── 0001_init/
        └── migration.sql              # What `prisma migrate dev` will generate
.env                                    # DATABASE_URL placeholder — replace before use
```

## Setup

```bash
npm install
npm install bcrypt   # used by seed.js for password hashing

# Edit .env with your real Postgres connection string

npx prisma migrate dev --name init
npx prisma generate

# Add to package.json:
#   "prisma": { "seed": "node prisma/seed.js" }
npx prisma db seed
```

## Design decisions worth knowing about

- **`basic_salary` lives on `payslips`, not `earning_details`.** It's a single fixed
  value per payslip, not a dynamic list item — putting it in the 1-to-N table would force
  every query to filter it out specially.
- **Totals are cached, not computed on read.** A Postgres trigger (`recalc_payslip_totals`)
  recalculates `total_earnings`, `total_deductions`, and `net_pay` automatically whenever
  earning/deduction rows are inserted, updated, or deleted. This means you never call a
  calculation function from the app layer — just write the line items and read the payslip
  back.
- **`(employee_id, period_month, period_year)` is unique.** Prevents HR from accidentally
  generating two payslips for the same person in the same month.
- **`AuditLog` was added beyond your original spec.** Payroll data needs a "who did what,
  when" trail for compliance — flagged this in my earlier response too.
- **`nik` and `date_of_birth` are stored on `Employee`** because the spec calls for
  deriving the PDF owner-password from them. As I noted before: this is weak protection
  in practice (NIK isn't actually secret), and these columns should get application-level
  or `pgcrypto` encryption at rest before this goes anywhere near production.

## Next steps

This is the database layer only. Still to build: Express API + RBAC middleware,
Puppeteer PDF template, BullMQ mailer/import workers, and the React form wizard —
happy to pick up any of those next.
