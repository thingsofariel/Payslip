-- ============================================================
-- Migration: 0001_init
-- Generated to match prisma/schema.prisma
-- This is what `npx prisma migrate dev --name init` will produce.
-- Provided here so the schema can be reviewed/run even without
-- the Prisma CLI available.
-- ============================================================

-- ENUMS
CREATE TYPE "EmploymentStatus" AS ENUM ('PERMANENT', 'CONTRACT', 'FREELANCE', 'INTERN');
CREATE TYPE "UserRole" AS ENUM ('ADMIN_HR', 'EMPLOYEE');
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'FINALIZED', 'SENT', 'ARCHIVED');
CREATE TYPE "EarningCategory" AS ENUM ('ALLOWANCE', 'BONUS', 'OVERTIME', 'INCENTIVE', 'OTHER');
CREATE TYPE "DeductionCategory" AS ENUM ('BPJS_HEALTH', 'BPJS_PENSION', 'PPH21_TAX', 'ABSENCE_PENALTY', 'SALARY_ADVANCE', 'OTHER');

-- ------------------------------------------------------------
-- employees
-- ------------------------------------------------------------
CREATE TABLE "employees" (
    "employee_id"        SERIAL PRIMARY KEY,
    "full_name"           VARCHAR(150) NOT NULL,
    "job_title"           VARCHAR(100) NOT NULL,
    "employment_status"   "EmploymentStatus" NOT NULL DEFAULT 'PERMANENT',
    "email"               VARCHAR(150) NOT NULL UNIQUE,
    "bank_account_no"     VARCHAR(50) NOT NULL,
    "nik"                 VARCHAR(30) UNIQUE,
    "date_of_birth"       DATE,
    "password_hash"       VARCHAR(255) NOT NULL,
    "role"                "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "employees_email_idx" ON "employees"("email");

-- ------------------------------------------------------------
-- payslips
-- ------------------------------------------------------------
CREATE TABLE "payslips" (
    "payslip_id"           SERIAL PRIMARY KEY,
    "employee_id"          INTEGER NOT NULL,
    "period_month"         INTEGER NOT NULL,
    "period_year"          INTEGER NOT NULL,
    "issue_date"           DATE NOT NULL,
    "issue_location"       VARCHAR(100) NOT NULL DEFAULT 'Kupang',
    "basic_salary"         DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_earnings"       DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deductions"     DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_pay"              DECIMAL(14,2) NOT NULL DEFAULT 0,
    "authorized_signatory" VARCHAR(150) NOT NULL,
    "status"               "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "verification_hash"    VARCHAR(64),
    "pdf_path"             VARCHAR(255),
    "pdf_generated_at"     TIMESTAMPTZ,
    "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "fk_payslips_employee"
        FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT,
    CONSTRAINT "uniq_employee_period"
        UNIQUE ("employee_id", "period_month", "period_year"),
    CONSTRAINT "chk_period_month"
        CHECK ("period_month" BETWEEN 1 AND 12)
);
CREATE INDEX "payslips_employee_period_idx" ON "payslips"("employee_id", "period_year", "period_month");
CREATE INDEX "payslips_status_idx" ON "payslips"("status");

-- ------------------------------------------------------------
-- earning_details
-- ------------------------------------------------------------
CREATE TABLE "earning_details" (
    "earning_id"  SERIAL PRIMARY KEY,
    "payslip_id"  INTEGER NOT NULL,
    "label"       VARCHAR(150) NOT NULL,
    "category"    "EarningCategory" NOT NULL DEFAULT 'ALLOWANCE',
    "amount"      DECIMAL(14,2) NOT NULL,
    "sort_order"  INTEGER NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "fk_earning_payslip"
        FOREIGN KEY ("payslip_id") REFERENCES "payslips"("payslip_id") ON DELETE CASCADE,
    CONSTRAINT "chk_earning_amount_nonneg" CHECK ("amount" >= 0)
);
CREATE INDEX "earning_details_payslip_idx" ON "earning_details"("payslip_id");

-- ------------------------------------------------------------
-- deduction_details
-- ------------------------------------------------------------
CREATE TABLE "deduction_details" (
    "deduction_id" SERIAL PRIMARY KEY,
    "payslip_id"   INTEGER NOT NULL,
    "label"        VARCHAR(150) NOT NULL,
    "category"     "DeductionCategory" NOT NULL DEFAULT 'OTHER',
    "amount"       DECIMAL(14,2) NOT NULL,
    "sort_order"   INTEGER NOT NULL DEFAULT 0,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "fk_deduction_payslip"
        FOREIGN KEY ("payslip_id") REFERENCES "payslips"("payslip_id") ON DELETE CASCADE,
    CONSTRAINT "chk_deduction_amount_nonneg" CHECK ("amount" >= 0)
);
CREATE INDEX "deduction_details_payslip_idx" ON "deduction_details"("payslip_id");

-- ------------------------------------------------------------
-- audit_logs
-- ------------------------------------------------------------
CREATE TABLE "audit_logs" (
    "log_id"      SERIAL PRIMARY KEY,
    "payslip_id"  INTEGER,
    "actor_id"    INTEGER NOT NULL,
    "action"      VARCHAR(50) NOT NULL,
    "detail"      TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "fk_audit_payslip"
        FOREIGN KEY ("payslip_id") REFERENCES "payslips"("payslip_id") ON DELETE SET NULL,
    CONSTRAINT "fk_audit_actor"
        FOREIGN KEY ("actor_id") REFERENCES "employees"("employee_id")
);
CREATE INDEX "audit_logs_payslip_idx" ON "audit_logs"("payslip_id");
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("actor_id");

-- ============================================================
-- TRIGGER: auto-recalculate cached totals on payslips whenever
-- earning_details or deduction_details rows change.
-- This keeps total_earnings / total_deductions / net_pay correct
-- without the application layer having to remember to do it.
-- ============================================================

CREATE OR REPLACE FUNCTION recalc_payslip_totals() RETURNS TRIGGER AS $$
DECLARE
    target_payslip_id INTEGER;
    v_earnings DECIMAL(14,2);
    v_deductions DECIMAL(14,2);
    v_basic DECIMAL(14,2);
BEGIN
    target_payslip_id := COALESCE(NEW.payslip_id, OLD.payslip_id);

    SELECT COALESCE(SUM(amount), 0) INTO v_earnings
        FROM earning_details WHERE payslip_id = target_payslip_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_deductions
        FROM deduction_details WHERE payslip_id = target_payslip_id;

    SELECT basic_salary INTO v_basic
        FROM payslips WHERE payslip_id = target_payslip_id;

    UPDATE payslips
    SET total_earnings   = v_basic + v_earnings,
        total_deductions = v_deductions,
        net_pay          = (v_basic + v_earnings) - v_deductions,
        updated_at       = now()
    WHERE payslip_id = target_payslip_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_on_earning
AFTER INSERT OR UPDATE OR DELETE ON earning_details
FOR EACH ROW EXECUTE FUNCTION recalc_payslip_totals();

CREATE TRIGGER trg_recalc_on_deduction
AFTER INSERT OR UPDATE OR DELETE ON deduction_details
FOR EACH ROW EXECUTE FUNCTION recalc_payslip_totals();
