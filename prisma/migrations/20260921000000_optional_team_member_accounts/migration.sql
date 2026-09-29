ALTER TABLE "TeamMember"
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "linkedAt" DROP NOT NULL,
ALTER COLUMN "linkedAt" DROP DEFAULT;

ALTER TABLE "TeamInvitation"
ADD COLUMN "teamMemberId" TEXT;

CREATE INDEX "TeamInvitation_teamMemberId_status_idx"
ON "TeamInvitation"("teamMemberId", "status");

ALTER TABLE "TeamInvitation"
ADD CONSTRAINT "TeamInvitation_teamMemberId_fkey"
FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
