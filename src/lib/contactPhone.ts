export function phoneHref(phone: string) {
  const value = phone.trim();
  if (!/^\+?[\d\s().-]{3,32}$/.test(value)) return null;
  const digits = value.replace(/[^\d+]/g, '');
  return digits.length >= 3 ? `tel:${digits}` : null;
}
