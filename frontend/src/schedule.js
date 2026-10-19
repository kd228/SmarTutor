// Mirrors how the server lays out a course: sessions per week land on days 0 | 0,3 | 0,2,4 of each
// week, at the same local time of day as the first session. Used only for the preview before enrolling;
// the server builds the real schedule.
const OFFSETS = { 1: [0], 2: [0, 3], 3: [0, 2, 4] };

export function previewSchedule(startsAt, totalSessions, sessionsPerWeek) {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return [];
  const offsets = OFFSETS[sessionsPerWeek] || OFFSETS[1];
  return Array.from({ length: totalSessions }, (_, k) => {
    const d = new Date(start);
    d.setDate(d.getDate() + Math.floor(k / sessionsPerWeek) * 7 + offsets[k % sessionsPerWeek]);
    return d;
  });
}
