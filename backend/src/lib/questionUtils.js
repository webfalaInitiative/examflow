import { Prisma } from '@prisma/client';

/**
 * Shared helpers so that questions created manually, imported via JSON/CSV,
 * or edited later are all stored in the SAME canonical shape:
 *   - options: string[]  (MCQ only, otherwise DB NULL)
 *   - correct: number    (0-based option index for MCQ) | string (theory rubric) | DB NULL
 *   - explanation: string | null
 *
 * JSON files exported from other tools often use different shapes
 * (e.g. options as an object {A: "...", B: "..."}, options as objects with
 * { text, isCorrect }, correct answer as a letter "B" or as the option text).
 * Storing those raw shapes is what previously broke the edit form for
 * JSON-imported questions, so everything is normalized here.
 */

const MCQ_ALIASES = ['mcq', 'multiple_choice', 'multiple-choice', 'multiplechoice', 'objective', 'choice', 'single_choice'];
const THEORY_ALIASES = ['theory', 'essay', 'short_answer', 'short-answer', 'text', 'open', 'subjective', 'long_answer'];

function optionToText(opt) {
  if (opt == null) return '';
  if (typeof opt === 'string') return opt;
  if (typeof opt === 'number' || typeof opt === 'boolean') return String(opt);
  if (typeof opt === 'object') {
    const v = opt.text ?? opt.label ?? opt.value ?? opt.option ?? opt.answer ?? opt.content;
    if (v != null) return String(v);
    return JSON.stringify(opt);
  }
  return String(opt);
}

function isFlaggedCorrect(opt) {
  return Boolean(opt && typeof opt === 'object' && (opt.isCorrect === true || opt.correct === true || opt.is_correct === true));
}

/** Returns { options: string[], keys: string[] | null, flaggedIndex: number } */
export function normalizeOptions(raw) {
  let value = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return { options: [], keys: null, flaggedIndex: -1 };
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        value = trimmed.split(/\r?\n|[;|]/);
      }
    } else {
      value = trimmed.split(/\r?\n|[;|]/);
    }
  }

  if (Array.isArray(value)) {
    const flaggedIndex = value.findIndex(isFlaggedCorrect);
    const options = value.map(optionToText).map((s) => s.trim()).filter((s) => s !== '');
    return { options, keys: null, flaggedIndex };
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    const vals = keys.map((k) => value[k]);
    const flaggedIndex = vals.findIndex(isFlaggedCorrect);
    return { options: vals.map(optionToText).map((s) => s.trim()), keys, flaggedIndex };
  }

  return { options: [], keys: null, flaggedIndex: -1 };
}

/** Resolve any supported "correct answer" representation into a 0-based index (or -1). */
export function resolveCorrectIndex(rawCorrect, options, keys = null, flaggedIndex = -1) {
  if (flaggedIndex >= 0 && (rawCorrect === undefined || rawCorrect === null || rawCorrect === '')) {
    return flaggedIndex;
  }
  if (rawCorrect === undefined || rawCorrect === null || rawCorrect === '') return flaggedIndex;

  let c = rawCorrect;
  if (Array.isArray(c)) c = c[0];
  if (c && typeof c === 'object') c = c.index ?? c.text ?? c.value ?? c.label;

  if (typeof c === 'number' && Number.isInteger(c)) {
    return c >= 0 && c < options.length ? c : -1;
  }

  const str = String(c).trim();
  if (/^\d+$/.test(str)) {
    const n = parseInt(str, 10);
    // An option whose text is literally this number wins over index interpretation
    const textMatch = options.findIndex((o) => o.trim() === str);
    if (textMatch >= 0 && (n < 0 || n >= options.length)) return textMatch;
    return n >= 0 && n < options.length ? n : textMatch;
  }

  // Matches an object key, e.g. options {A: "...", B: "..."} with correct "B"
  if (keys) {
    const keyIdx = keys.findIndex((k) => k.trim().toLowerCase() === str.toLowerCase());
    if (keyIdx >= 0) return keyIdx;
  }

  // Matches the option text itself
  const textIdx = options.findIndex((o) => o.trim().toLowerCase() === str.toLowerCase());
  if (textIdx >= 0) return textIdx;

  // Single letter A–Z (also "A)", "(b)", "option c")
  const letter = str.replace(/^option\s*/i, '').replace(/[().:\s]/g, '');
  if (/^[a-z]$/i.test(letter)) {
    const idx = letter.toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) return idx;
  }

  return -1;
}

function normalizeType(rawType, hasOptions) {
  const t = String(rawType || '').trim().toLowerCase();
  if (MCQ_ALIASES.includes(t)) return 'mcq';
  if (THEORY_ALIASES.includes(t)) return 'theory';
  if (!t) return hasOptions ? 'mcq' : 'theory';
  return t; // will be rejected by validation
}

/**
 * Normalize an incoming question payload (manual form, JSON import, CSV import, or edit).
 * Throws an Error with a human friendly message when the payload is invalid.
 */
export function normalizeQuestionInput(q, { label = 'Question' } = {}) {
  if (!q || typeof q !== 'object') throw new Error(`${label}: invalid question entry`);

  const title = String(q.title ?? q.question ?? q.questionText ?? q.text ?? q.prompt ?? '').trim();
  const rawOptions = q.options ?? q.choices ?? q.answers ?? null;
  const { options, keys, flaggedIndex } = normalizeOptions(rawOptions);
  const type = normalizeType(q.type, options.length > 0);

  if (!title) throw new Error(`${label}: title is required`);
  if (!['mcq', 'theory'].includes(type)) throw new Error(`${label}: type must be "mcq" or "theory"`);

  const bodyRaw = q.body ?? q.description ?? q.details ?? null;
  const body = bodyRaw != null && String(bodyRaw).trim() !== '' ? String(bodyRaw) : null;

  const explanationRaw = q.explanation ?? q.rationale ?? q.solution ?? null;
  const explanation = explanationRaw != null && String(explanationRaw).trim() !== '' ? String(explanationRaw) : null;

  const rawCorrect = q.correct ?? q.correctIndex ?? q.correctAnswer ?? q.correct_answer ?? q.answer ?? null;

  if (type === 'mcq') {
    if (options.length < 2) throw new Error(`${label}: MCQ questions require at least 2 options`);
    if (options.some((o) => o === '')) throw new Error(`${label}: MCQ options cannot be empty`);
    const correctIndex = resolveCorrectIndex(rawCorrect, options, keys, flaggedIndex);
    if (correctIndex < 0) {
      throw new Error(`${label}: could not determine the correct option (use an index, a letter like "B", or the exact option text)`);
    }
    return { title, type, body, options, correct: correctIndex, explanation };
  }

  const correctText = rawCorrect != null && String(rawCorrect).trim() !== '' ? String(rawCorrect) : null;
  return { title, type, body, options: null, correct: correctText, explanation };
}

/** Convert JS null to Prisma DB NULL for nullable Json columns (plain null is rejected by Prisma). */
export function toPrismaData(normalized) {
  return {
    ...normalized,
    options: normalized.options == null ? Prisma.DbNull : normalized.options,
    correct: normalized.correct == null ? Prisma.DbNull : normalized.correct,
  };
}

/** Normalize an already-stored question for API output, so legacy/imported rows render & edit correctly. */
export function normalizeStoredQuestion(question) {
  if (!question) return question;
  if (question.type !== 'mcq') return question;
  const { options, keys, flaggedIndex } = normalizeOptions(question.options);
  const idx = resolveCorrectIndex(question.correct, options, keys, flaggedIndex);
  return {
    ...question,
    options,
    correct: idx >= 0 ? idx : question.correct,
  };
}

