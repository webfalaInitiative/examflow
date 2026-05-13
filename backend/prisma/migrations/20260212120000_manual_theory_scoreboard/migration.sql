-- Admin theory score per student on scoreboard (0–100), combined with objective (MCQ) for final %

ALTER TABLE "ExamAssignment" ADD COLUMN IF NOT EXISTS "manualTheoryPercent" DOUBLE PRECISION;
