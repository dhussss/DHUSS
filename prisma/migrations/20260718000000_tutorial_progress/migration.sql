CREATE TABLE "TutorialProgress" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tutorialKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorialProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TutorialProgress_ownerId_tutorialKey_key"
ON "TutorialProgress"("ownerId", "tutorialKey");

CREATE INDEX "TutorialProgress_ownerId_status_idx"
ON "TutorialProgress"("ownerId", "status");

-- Tutorial progress is accessed through authenticated Next.js server code only.
ALTER TABLE "TutorialProgress" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE "TutorialProgress" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE "TutorialProgress" FROM authenticated;
  END IF;
END $$;
