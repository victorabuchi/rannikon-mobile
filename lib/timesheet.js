export const VALID_START_TIMES = ['09:00', '09:15', '09:30', '09:45'];

export function toMins(t) {
  if (!t) return 0;
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(m) {
  if (m <= 0) return '0:00';
  return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
}

export function minsToHHMM(m) {
  if (m <= 0) return '';
  return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
}

export function addMins(t, add) {
  const total = toMins(t) + add;
  return (
    String(Math.floor(total / 60) % 24).padStart(2, '0') +
    ':' +
    String(total % 60).padStart(2, '0')
  );
}

// Mirrors computeEntry from berrystime-frontend/pages/dashboard.js exactly.
export function computeEntry(e) {
  if (!e?.actual_start || !e?.actual_finish) return e;
  const totalBreak = Math.max(30, e.break_mins || 30);
  const extraBreak = totalBreak - 30;
  const workedMins = toMins(e.actual_finish) - toMins(e.actual_start);
  if (workedMins >= 510) {
    const wFinish = addMins(e.actual_start, 510);
    const oMins = Math.max(0, toMins(e.actual_finish) - toMins(wFinish) - extraBreak);
    return {
      ...e,
      white_finish: wFinish,
      white_hours: '8:00',
      orange_start: wFinish,
      orange_hours: toHHMM(oMins),
      total_hours: toHHMM(480 + oMins),
      orange_break: toHHMM(extraBreak),
    };
  }
  const wHours = toHHMM(Math.max(0, workedMins - totalBreak));
  return {
    ...e,
    white_hours: wHours,
    orange_start: e.actual_finish,
    orange_hours: '0:00',
    total_hours: wHours,
    orange_break: '0:00',
  };
}

export function parseHoursToMinutes(value) {
  if (value == null || value === '') return 0;
  const [h, m] = String(value).split(':');
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

export function hasOrangeWork(entry) {
  return !!(entry && entry.orange_hours && entry.orange_hours !== '0:00' && entry.orange_hours !== '0:0');
}
