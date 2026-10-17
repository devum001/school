import { z } from 'zod';
export const TEMPLATE_IDS = ['classic', 'ribbon', 'ledger', 'minimal', 'frame', 'sidebar'] as const;
export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank', 'Bank transfer', 'Card', 'Cheque'] as const;
export const moneySchema = z.number().int().min(0).max(100000000000);
export const imageDataSchema = z
  .string()
  .max(700000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/);
export const templateChoiceSchema = z.object({
  templateId: z.enum(TEMPLATE_IDS),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  colors: z.partialRecord(z.enum(TEMPLATE_IDS), z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
});
export const documentBrandingSchema = z.object({
  logo: imageDataSchema.nullable().optional(),
  header: imageDataSchema.nullable().optional(),
  footer: imageDataSchema.nullable().optional(),
  signature: imageDataSchema.nullable().optional(),
  stamp: imageDataSchema.nullable().optional(),
});
export const documentTemplatesSchema = z.object({
  feeReceipt: templateChoiceSchema,
  salarySlip: templateChoiceSchema,
  branding: documentBrandingSchema.optional(),
});
export const generatedDocumentSchema = z.object({
  kind: z.enum(['Fee Receipt', 'Salary Slip']),
  number: z.string(),
  schoolName: z.string(),
  schoolLogo: imageDataSchema.optional(),
  branding: documentBrandingSchema.optional(),
  recipientName: z.string(),
  date: z.iso.date(),
  createdAt: z.iso.datetime(),
  template: templateChoiceSchema,
  fields: z.array(z.object({ label: z.string(), value: z.string() })),
  amount: moneySchema,
  amountLabel: z.string(),
});
export const recordedDocumentDataSchema = generatedDocumentSchema.omit({
  schoolName: true,
  schoolLogo: true,
  branding: true,
  template: true,
});
export const feePlanInputSchema = z
  .object({
    kind: z.enum(['One Time', 'Installments']),
    totalFee: moneySchema,
    installments: z
      .array(z.object({ id: z.string().optional(), amount: moneySchema, dueDate: z.iso.date() }))
      .min(1)
      .max(60),
  })
  .refine(
    (plan) => plan.kind !== 'One Time' || plan.installments.length === 1,
    'One Time requires one amount and one due date.',
  )
  .refine(
    (plan) => plan.installments.reduce((sum, item) => sum + item.amount, 0) === plan.totalFee,
    'Installment amounts must add up to Total Fee.',
  )
  .refine(
    (plan) => plan.kind !== 'Installments' || plan.installments.every((item) => item.amount > 0),
    'Installment amounts must be greater than zero.',
  )
  .refine((plan) => {
    const ids = plan.installments.flatMap((item) => (item.id ? [item.id] : []));
    return new Set(ids).size === ids.length;
  }, 'Installment identifiers must be unique.');
export const studentFeePlanSchema = z.object({
  schoolId: z.string(),
  enrollmentId: z.string(),
  kind: z.enum(['One Time', 'Installments']),
  totalFee: moneySchema,
});
export const paymentAllocationSchema = z.object({
  obligationId: z.string(),
  amount: moneySchema.positive(),
});
export const paymentRecordSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  enrollmentId: z.string(),
  studentId: z.string().optional(),
  amount: moneySchema.positive(),
  date: z.iso.date(),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string(),
  allocations: z.array(paymentAllocationSchema).optional(),
  installmentId: z.string().optional(),
  receiptNumber: z.string().optional(),
  receivedBy: z.string().optional(),
  createdAt: z.iso.datetime().optional(),
  document: recordedDocumentDataSchema.optional(),
});
export const salaryPaymentSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  staffId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  cycleStart: z.iso.date(),
  cycleEnd: z.iso.date(),
  gross: moneySchema,
  leaveDeduction: moneySchema,
  manualDeduction: moneySchema,
  net: moneySchema,
  leaveDays: z.number().min(0).multipleOf(0.5),
  amountPaid: moneySchema,
  method: z.enum(['Bank', 'UPI', 'Cash']),
  date: z.iso.date(),
  reference: z.string().max(80),
  slipNumber: z.string(),
  createdAt: z.iso.datetime(),
  recordedBy: z.string(),
  status: z.literal('Paid'),
  document: recordedDocumentDataSchema,
});
export const storedDocumentSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  ownerKind: z.enum(['student', 'staff']),
  ownerId: z.string(),
  category: z.string().min(1).max(80),
  fileName: z.string().min(1).max(200),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  dataUrl: z
    .string()
    .max(3000000)
    .regex(/^data:(application\/pdf|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/=]+$/),
  size: z
    .number()
    .int()
    .positive()
    .max(2 * 1024 * 1024),
  uploadedAt: z.iso.datetime(),
  uploadedBy: z.string(),
});
