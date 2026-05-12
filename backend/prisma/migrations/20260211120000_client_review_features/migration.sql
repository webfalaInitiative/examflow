-- Client review: moderation, account status, exam results publishing, assignment submitted time

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';

ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "resultsPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "resultsPublishedAt" TIMESTAMP(3);

-- Keep existing exams visible to students; new exams still default to false in application create if you change schema default later
UPDATE "Exam" SET "resultsPublished" = true WHERE "resultsPublished" = false;

ALTER TABLE "ExamAssignment" ADD COLUMN IF NOT EXISTS "examSubmittedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ModerationLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ModerationLog_actorId_fkey'
  ) THEN
    ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
