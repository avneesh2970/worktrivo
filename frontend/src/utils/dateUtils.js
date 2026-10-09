/**
 * Unified Date and Time utilities for WorkTrivo.
 * Ensures consistent time formatting and preserves local datetime in edit forms.
 */

/**
 * Standard formatted date & time: e.g. "Oct 10, 2026, 05:30 PM"
 */
export const formatDateTime = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Standard formatted date: e.g. "Oct 10, 2026"
 */
export const formatDate = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Standard formatted time: e.g. "05:30 PM"
 */
export const formatTime = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Converts any ISO / Date string to local "YYYY-MM-DDTHH:mm" for <input type="datetime-local" />.
 * Crucial: Does NOT shift into UTC, preserving the exact local hour and minute filled previously!
 */
export const toDateTimeLocalValue = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Converts any ISO / Date string to local "YYYY-MM-DD" for <input type="date" />.
 */
export const toDateLocalValue = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());

  return `${year}-${month}-${day}`;
};
