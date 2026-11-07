/** Present counts everyone attending, including Late and Half Day, once. */
export function matchesStaffAttendance(status: string | undefined, filter: string) {
  const value = status || 'unmarked';
  if (!filter || filter === 'all') return true;
  if (filter === 'present') return value === 'present' || value === 'late' || value === 'half-day';
  if (filter === 'late') return value === 'late';
  if (filter === 'half-day') return value === 'half-day';
  if (filter === 'absent') return value === 'absent';
  if (filter === 'leave') return value === 'leave';
  if (filter === 'off') return value === 'off';
  if (filter === 'holiday') return value === 'holiday';
  if (filter === 'unmarked') return value === 'unmarked' || value === 'pending';
  return value === filter;
}
