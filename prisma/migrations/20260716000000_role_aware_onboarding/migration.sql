CREATE TYPE "BusinessStructure" AS ENUM ('SOLE_TRADER', 'EMPLOYER');

ALTER TABLE "BusinessProfile"
ADD COLUMN "businessStructure" "BusinessStructure" NOT NULL DEFAULT 'SOLE_TRADER',
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

UPDATE "BusinessProfile"
SET "businessStructure" = 'EMPLOYER'
WHERE EXISTS (
  SELECT 1
  FROM "TeamMember"
  WHERE "TeamMember"."ownerId" = "BusinessProfile"."ownerId"
);

UPDATE "BusinessProfile"
SET "onboardingCompletedAt" = CURRENT_TIMESTAMP;
