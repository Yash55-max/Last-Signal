// ─── Toxicity Filter (MVP Blacklist) ─────────────────────

const bannedWords = [
  "hate", "kill", "idiot","fuck u","racist", "abuse",
  "stupid", "dumb", "moron", "loser", "creep",
  "slur", "trash", "scum", "freak", "pedo",
  "rapist", "retard", "nazi", "terrorist", "kys",
];

export function containsToxic(text) {
  const lower = text.toLowerCase();
  return bannedWords.some((word) => {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    return pattern.test(lower);
  });
}

// ─── Rate Limiting ───────────────────────────────────────

/**
 * Returns a throttle function that allows at most one call per minIntervalMs.
 * Each call site gets its own independent throttle instance.
 */
export function createThrottle(minIntervalMs) {
  let lastCallTime = 0;
  return function () {
    const now = Date.now();
    if (now - lastCallTime < minIntervalMs) return false;
    lastCallTime = now;
    return true;
  };
}

const canSendMessageThrottle = createThrottle(800);
export function canSendMessage() {
  return canSendMessageThrottle();
}
