/** Present counts everyone attending, including Late and Half Day, once. */
export function matchesStaffAttendance(status: string | undefined, filter: string) {
  const value = status || 'unmarked';
  return (
    !filter ||
    filter === 'all' ||
    value === filter ||
    (filter === 'present' && ['late', 'half-day'].includes(value))
  );
}
