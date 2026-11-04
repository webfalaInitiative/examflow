-- Add optional explanation to questions (idempotent so it is safe on databases synced with `prisma db push`)
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "explanation" TEXT;

