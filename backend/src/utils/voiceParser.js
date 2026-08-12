// Heuristic (regex-based) voice-transcript parser — no external NLP/AI API required.
// Extracts: priority, dueDate, matched assignees, and a cleaned-up title.

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function startOfDay(d) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

// Returns the next date (from `base`) that falls on `targetDow` (0=Sun..6=Sat).
// includeToday=true allows returning today if today already matches.
function getWeekday(base, targetDow, includeToday) {
  const result = startOfDay(base);
  const currentDow = result.getDay();
  let diff = (targetDow - currentDow + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  result.setDate(result.getDate() + diff);
  return result;
}

/**
 * Extracts a due date from the transcript.
 * Returns { date: Date|null, matchedText: string|null }
 */
function extractDueDate(rawText) {
  const text = rawText.toLowerCase();
  const now = new Date();

  // "in N day(s)" / "in N week(s)"
  let m = text.match(/\bin\s+(\d+)\s*(day|days|week|weeks)\b/);
  if (m) {
    const amount = parseInt(m[1], 10);
    const unit = m[2].startsWith('week') ? 7 : 1;
    const d = startOfDay(now);
    d.setDate(d.getDate() + amount * unit);
    d.setHours(18, 0, 0, 0);
    return { date: d, matchedText: m[0] };
  }

  // "end of week" / "eow"
  if (/\b(end of week|eow)\b/.test(text)) {
    const d = getWeekday(now, 5, true); // Friday
    d.setHours(18, 0, 0, 0);
    return { date: d, matchedText: text.match(/\b(end of week|eow)\b/)[0] };
  }

  // "end of day" / "eod" / "today"
  if (/\b(end of day|eod)\b/.test(text)) {
    const d = startOfDay(now);
    d.setHours(18, 0, 0, 0);
    return { date: d, matchedText: text.match(/\b(end of day|eod)\b/)[0] };
  }
  if (/\btoday\b/.test(text)) {
    const d = startOfDay(now);
    d.setHours(18, 0, 0, 0);
    return { date: d, matchedText: 'today' };
  }

  // "tomorrow"
  if (/\btomorrow\b/.test(text)) {
    const d = startOfDay(now);
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return { date: d, matchedText: 'tomorrow' };
  }

  // "next <weekday>" / "this <weekday>" / "by <weekday>"
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const day = WEEKDAYS[i];
    const nextRe = new RegExp(`\\bnext ${day}\\b`);
    const thisRe = new RegExp(`\\bthis ${day}\\b`);
    const byRe = new RegExp(`\\bby ${day}\\b`);
    if (nextRe.test(text)) {
      const d = getWeekday(now, i, false);
      d.setDate(d.getDate() + 7); // "next" explicitly skips this week's occurrence
      d.setHours(18, 0, 0, 0);
      return { date: d, matchedText: `next ${day}` };
    }
    if (thisRe.test(text)) {
      const d = getWeekday(now, i, true);
      d.setHours(18, 0, 0, 0);
      return { date: d, matchedText: `this ${day}` };
    }
    if (byRe.test(text)) {
      const d = getWeekday(now, i, false);
      d.setHours(18, 0, 0, 0);
      return { date: d, matchedText: `by ${day}` };
    }
  }

  // Explicit "<Month> <Day>" e.g. "march 5", "on march 5th"
  const monthPattern = MONTHS.join('|');
  const explicitRe = new RegExp(`\\b(${monthPattern})\\.?\\s+(\\d{1,2})(st|nd|rd|th)?\\b`);
  m = text.match(explicitRe);
  if (m) {
    const monthIndex = MONTHS.indexOf(m[1]);
    const day = parseInt(m[2], 10);
    let year = now.getFullYear();
    let d = new Date(year, monthIndex, day, 18, 0, 0, 0);
    if (d < now) {
      d = new Date(year + 1, monthIndex, day, 18, 0, 0, 0);
    }
    return { date: d, matchedText: m[0] };
  }

  return { date: null, matchedText: null };
}

/**
 * Extracts a priority level from the transcript.
 * Returns { priority: string, matchedText: string|null }
 */
function extractPriority(rawText) {
  const text = rawText.toLowerCase();
  if (/\b(urgent|asap|immediately|critical)\b/.test(text)) {
    return { priority: 'Urgent', matchedText: text.match(/\b(urgent|asap|immediately|critical)\b/)[0] };
  }
  if (/\bhigh priority\b/.test(text)) {
    return { priority: 'High', matchedText: 'high priority' };
  }
  if (/\bmedium priority\b/.test(text)) {
    return { priority: 'Medium', matchedText: 'medium priority' };
  }
  if (/\blow priority\b/.test(text)) {
    return { priority: 'Low', matchedText: 'low priority' };
  }
  return { priority: 'Medium', matchedText: null };
}

/**
 * Matches user names mentioned in the transcript against the provided user list.
 * Supports "assign to X", "assigned to X", "for X", or a bare name mention.
 * Returns { assignees: [{_id, name}], matchedTexts: string[] }
 */
function extractAssignees(rawText, users) {
  const assignees = [];
  const matchedTexts = [];

  for (const user of users) {
    const firstName = (user.name || '').trim().split(' ')[0];
    if (!firstName) continue;

    const escapedFull = escapeRegExp(user.name.trim());
    const escapedFirst = escapeRegExp(firstName);

    // Prefer "assign(ed) to <name>" / "for <name>" phrasing, fall back to bare name mention.
    const phraseRe = new RegExp(`\\b(assign(?:ed)? to|for)\\s+(${escapedFull}|${escapedFirst})\\b`, 'i');
    const bareFullRe = new RegExp(`\\b${escapedFull}\\b`, 'i');
    const bareFirstRe = new RegExp(`\\b${escapedFirst}\\b`, 'i');

    let match = rawText.match(phraseRe) || rawText.match(bareFullRe) || rawText.match(bareFirstRe);
    if (match) {
      assignees.push({ _id: user._id, name: user.name });
      matchedTexts.push(match[0]);
    }
  }

  return { assignees, matchedTexts };
}

/**
 * Builds a clean task title by stripping out the phrases that were
 * identified as priority / due-date / assignee signals.
 */
function buildTitle(rawText, phrasesToStrip) {
  let working = rawText;
  for (const phrase of phrasesToStrip) {
    if (!phrase) continue;
    const re = new RegExp(escapeRegExp(phrase), 'ig');
    working = working.replace(re, ' ');
  }
  // Clean up leftover connector words and extra whitespace/punctuation.
  working = working
    .replace(/\b(assign(?:ed)? to|please|task|create|add|remind|remember to)\b/ig, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim();

  // Strip dangling leading/trailing filler words left behind after the
  // phrase removals above (e.g. a stray "to" or "by" at either edge).
  const fillerWords = ['a', 'an', 'to', 'by', 'and', 'the', 'that', 'so'];
  let words = working.split(/\s+/).filter(Boolean);
  while (words.length > 1 && fillerWords.includes(words[0].toLowerCase())) {
    words.shift();
  }
  while (words.length > 1 && fillerWords.includes(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  working = words.join(' ');

  if (!working) working = rawText.trim();
  return working.charAt(0).toUpperCase() + working.slice(1);
}

/**
 * Main entry point.
 * @param {string} transcript - raw speech-to-text transcript from the browser
 * @param {Array<{_id, name}>} users - active users eligible for assignment
 */
function parseVoiceTranscript(transcript, users) {
  const text = (transcript || '').trim();
  if (!text) {
    return { title: '', priority: 'Medium', dueDate: null, assignees: [], warnings: ['Empty transcript.'] };
  }

  const { priority, matchedText: priorityPhrase } = extractPriority(text);
  const { date: dueDate, matchedText: datePhrase } = extractDueDate(text);
  const { assignees, matchedTexts: assigneePhrases } = extractAssignees(text, users);

  const title = buildTitle(text, [priorityPhrase, datePhrase, ...assigneePhrases]);

  const warnings = [];
  if (!dueDate) warnings.push('No due date detected — defaulting to 2 days from now. Please review.');
  if (assignees.length === 0) warnings.push('No team member recognized in the transcript — please assign manually.');

  const finalDueDate = dueDate || (() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + 2);
    d.setHours(18, 0, 0, 0);
    return d;
  })();

  return { title, priority, dueDate: finalDueDate, assignees, warnings };
}

module.exports = { parseVoiceTranscript };