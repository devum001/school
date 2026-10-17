export function installmentName(number: number, oneTime = false): string {
  if (oneTime) return 'One-time fee';
  const lastTwo = number % 100;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[number % 10] ?? 'th');
  return `${number}${suffix} installment`;
}

/** Presentation only: old saved receipt amounts and payment records stay unchanged. */
export const normalizeInstallmentText = (value: string): string =>
  value.replace(/\b(?:Term|Installment)\s+(\d+)(?:\/\d+)?/gi, (_, number: string) =>
    installmentName(Number(number)),
  );
