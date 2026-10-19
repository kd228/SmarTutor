// Express 4 does not catch rejected promises from async handlers; this forwards them to the error handler.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Parses a positive 32-bit integer id from user input, or returns null.
export function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 2147483647 ? n : null;
}

export function feeFor(amountCents) {
  const percent = Number(process.env.PLATFORM_FEE_PERCENT ?? 15);
  return Math.round((amountCents * (Number.isFinite(percent) ? percent : 15)) / 100);
}

export function validTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Escapes LIKE wildcards so a search for "100%" matches literally.
export const likeTerm = (text) => `%${String(text).slice(0, 100).toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;
