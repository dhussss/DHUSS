CREATE TYPE "TeamInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');
CREATE TYPE "TeamMemberStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "TeamApprovalStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "TeamPaymentStatus" AS ENUM ('UNPAID', 'PAID');

CREATE TABLE "TeamInvitation" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "subcontractorName" TEXT NOT NULL,
  "subcontractorEmail" TEXT,
  "defaultPayRateCents" INTEGER NOT NULL,
  "defaultChargeRateCents" INTEGER NOT NULL,
  "status" "TeamInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedByUserId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMember" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "email" TEXT,
  "defaultPayRateCents" INTEGER NOT NULL,
  "defaultChargeRateCents" INTEGER NOT NULL,
  "status" "TeamMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectAssignment" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "teamMemberId" TEXT NOT NULL,
  "payRateCents" INTEGER NOT NULL,
  "chargeRateCents" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TimeEntry"
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "teamMemberId" TEXT,
ADD COLUMN "projectAssignmentId" TEXT,
ADD COLUMN "workerDisplayNameSnapshot" TEXT,
ADD COLUMN "approvalStatus" "TeamApprovalStatus",
ADD COLUMN "payRateCentsSnapshot" INTEGER,
ADD COLUMN "paymentStatus" "TeamPaymentStatus",
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "paymentReference" TEXT;

CREATE UNIQUE INDEX "TeamInvitation_tokenHash_key" ON "TeamInvitation"("tokenHash");
CREATE INDEX "TeamInvitation_ownerId_status_idx" ON "TeamInvitation"("ownerId", "status");
CREATE INDEX "TeamInvitation_expiresAt_idx" ON "TeamInvitation"("expiresAt");
CREATE UNIQUE INDEX "TeamMember_ownerId_userId_key" ON "TeamMember"("ownerId", "userId");
CREATE INDEX "TeamMember_ownerId_status_idx" ON "TeamMember"("ownerId", "status");
CREATE INDEX "TeamMember_userId_status_idx" ON "TeamMember"("userId", "status");
CREATE UNIQUE INDEX "ProjectAssignment_projectId_teamMemberId_key" ON "ProjectAssignment"("projectId", "teamMemberId");
CREATE INDEX "ProjectAssignment_ownerId_active_idx" ON "ProjectAssignment"("ownerId", "active");
CREATE INDEX "ProjectAssignment_teamMemberId_active_idx" ON "ProjectAssignment"("teamMemberId", "active");
CREATE INDEX "ProjectAssignment_projectId_active_idx" ON "ProjectAssignment"("projectId", "active");
CREATE INDEX "TimeEntry_createdByUserId_date_idx" ON "TimeEntry"("createdByUserId", "date");
CREATE INDEX "TimeEntry_ownerId_approvalStatus_idx" ON "TimeEntry"("ownerId", "approvalStatus");
CREATE INDEX "TimeEntry_ownerId_paymentStatus_idx" ON "TimeEntry"("ownerId", "paymentStatus");
CREATE INDEX "TimeEntry_teamMemberId_date_idx" ON "TimeEntry"("teamMemberId", "date");
CREATE INDEX "TimeEntry_projectAssignmentId_idx" ON "TimeEntry"("projectAssignmentId");

ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectAssignmentId_fkey" FOREIGN KEY ("projectAssignmentId") REFERENCES "ProjectAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
