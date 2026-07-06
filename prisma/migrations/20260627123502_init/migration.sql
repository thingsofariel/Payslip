-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "fk_audit_actor";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "fk_audit_payslip";

-- DropForeignKey
ALTER TABLE "deduction_details" DROP CONSTRAINT "fk_deduction_payslip";

-- DropForeignKey
ALTER TABLE "earning_details" DROP CONSTRAINT "fk_earning_payslip";

-- DropForeignKey
ALTER TABLE "payslips" DROP CONSTRAINT "fk_payslips_employee";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "action" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "deduction_details" ALTER COLUMN "label" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "earning_details" ALTER COLUMN "label" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "full_name" SET DATA TYPE TEXT,
ALTER COLUMN "job_title" SET DATA TYPE TEXT,
ALTER COLUMN "email" SET DATA TYPE TEXT,
ALTER COLUMN "bank_account_no" SET DATA TYPE TEXT,
ALTER COLUMN "nik" SET DATA TYPE TEXT,
ALTER COLUMN "password_hash" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payslips" ALTER COLUMN "issue_location" SET DATA TYPE TEXT,
ALTER COLUMN "authorized_signatory" SET DATA TYPE TEXT,
ALTER COLUMN "verification_hash" SET DATA TYPE TEXT,
ALTER COLUMN "pdf_path" SET DATA TYPE TEXT,
ALTER COLUMN "pdf_generated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earning_details" ADD CONSTRAINT "earning_details_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("payslip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deduction_details" ADD CONSTRAINT "deduction_details_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("payslip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("payslip_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "audit_logs_actor_idx" RENAME TO "audit_logs_actor_id_idx";

-- RenameIndex
ALTER INDEX "audit_logs_payslip_idx" RENAME TO "audit_logs_payslip_id_idx";

-- RenameIndex
ALTER INDEX "deduction_details_payslip_idx" RENAME TO "deduction_details_payslip_id_idx";

-- RenameIndex
ALTER INDEX "earning_details_payslip_idx" RENAME TO "earning_details_payslip_id_idx";

-- RenameIndex
ALTER INDEX "payslips_employee_period_idx" RENAME TO "payslips_employee_id_period_year_period_month_idx";

-- RenameIndex
ALTER INDEX "uniq_employee_period" RENAME TO "payslips_employee_id_period_month_period_year_key";
