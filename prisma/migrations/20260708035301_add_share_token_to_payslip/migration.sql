/*
  Warnings:

  - A unique constraint covering the columns `[share_token]` on the table `payslips` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "payslips" ADD COLUMN     "share_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payslips_share_token_key" ON "payslips"("share_token");
