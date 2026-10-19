export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const courseLength = (c) => `${plural(c.totalSessions, 'session')} over ${plural(c.weeks, 'week')}`;

export const courseCadence = (c) => `${plural(c.sessionsPerWeek, 'session')} a week, ${c.sessionMinutes} minutes each`;
