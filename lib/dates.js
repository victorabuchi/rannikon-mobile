export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const DAY_NAMES_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

export function formatDate(year, month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function todayISODate() {
  const d = new Date();
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// "Friday, 12 June 2026"
export function formatDateLong(dateInput) {
  const d = new Date(dateInput);
  return `${DAY_NAMES_LONG[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// "12 June 2026"
export function formatDateMedium(dateInput) {
  const d = new Date(dateInput);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// "12 Jun 2026"
export function formatDateShort(dateInput) {
  const d = new Date(dateInput);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function addDaysToISODate(isoDate, delta) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}
