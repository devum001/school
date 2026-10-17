export type DocumentKind = 'Fee Receipt' | 'Salary Slip';
export type TemplateId = 'classic' | 'ribbon' | 'ledger' | 'minimal' | 'frame' | 'sidebar';
export interface TemplateChoice {
  templateId: TemplateId;
  accent: string;
  colors?: Partial<Record<TemplateId, string>>;
}
export type BrandingAsset = 'logo' | 'header' | 'footer' | 'signature' | 'stamp';
export type DocumentBranding = Partial<Record<BrandingAsset, string | null>>;
export interface DocumentTemplates {
  branding?: DocumentBranding;
  feeReceipt: TemplateChoice;
  salarySlip: TemplateChoice;
}
export interface GeneratedDocument {
  kind: DocumentKind;
  number: string;
  schoolName: string;
  schoolLogo?: string;
  branding?: DocumentBranding;
  recipientName: string;
  date: string;
  createdAt: string;
  template: TemplateChoice;
  fields: { label: string; value: string }[];
  amount: number;
  amountLabel: string;
}
// Persist transaction facts only; presentation is resolved from current settings.
export type RecordedDocumentData = Omit<
  GeneratedDocument,
  'schoolName' | 'schoolLogo' | 'branding' | 'template'
>;
export interface FeePlanInput {
  kind: 'One Time' | 'Installments';
  totalFee: number;
  installments: { id?: string; amount: number; dueDate: string }[];
}
export interface StudentFeePlan {
  schoolId: string;
  enrollmentId: string;
  kind: FeePlanInput['kind'];
  totalFee: number;
}
export interface PaymentAllocation {
  obligationId: string;
  amount: number;
}
export interface SalaryPayment {
  id: string;
  schoolId: string;
  staffId: string;
  month: string;
  cycleStart: string;
  cycleEnd: string;
  gross: number;
  leaveDeduction: number;
  manualDeduction: number;
  net: number;
  leaveDays: number;
  amountPaid: number;
  method: 'Bank' | 'UPI' | 'Cash';
  date: string;
  reference: string;
  slipNumber: string;
  createdAt: string;
  recordedBy: string;
  status: 'Paid';
  document: RecordedDocumentData;
}
export interface RecordSalaryPaymentInput {
  staffId: string;
  month: string;
  method: SalaryPayment['method'];
  date: string;
  reference: string;
}
export interface StoredDocument {
  id: string;
  schoolId: string;
  ownerKind: 'student' | 'staff';
  ownerId: string;
  category: string;
  fileName: string;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp';
  dataUrl: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}
