import type { RecordedDocumentData } from '../types/ledger';

/** Only printable facts belong to a payment record; artwork and design remain in settings. */
export function recordDocumentData(data: RecordedDocumentData): RecordedDocumentData {
  const { kind, number, recipientName, date, createdAt, amount, amountLabel } = data;
  return {
    kind,
    number,
    recipientName,
    date,
    createdAt,
    fields: data.fields.map((field) => ({ ...field })),
    amount,
    amountLabel,
  };
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function hasStoredDocumentPresentation(snapshot: unknown): boolean {
  if (!object(snapshot)) return false;
  return ['payments', 'salaryPayments'].some((key) => {
    const records = snapshot[key];
    return (
      Array.isArray(records) &&
      records.some((record: unknown) => {
        if (!object(record)) return false;
        const document = record.document;
        return (
          object(document) &&
          ['schoolName', 'schoolLogo', 'branding', 'template'].some((field) => field in document)
        );
      })
    );
  });
}
