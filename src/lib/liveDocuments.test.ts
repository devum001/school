import { describe, it, expect } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import {
  feeReceiptFor,
  salarySlipFor,
  documentWithBranding,
  documentTemplatesFor,
  saveDocumentTemplates,
} from './documentData';
import { recordDocumentData, hasStoredDocumentPresentation } from './recordedDocuments';
import { paymentRecordSchema, salaryPaymentSchema } from './ledgerSchemas';
import { saveStaffMember } from './staffStructure';
import { defaultStaffPayroll } from './settings';
import { recordStudentPayment, recordSalaryPayment } from './financeTransactions';
import { financeEntries } from './financeLedger';

const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

describe('data-only financial documents and current presentation', () => {
  it('updates all current branding and template colors on old receipts without changing transaction facts', () => {
    const initial = createSeed('2026-10-15');
    const payment = initial.payments[0];
    const frozen = feeReceiptFor(initial, payment);
    const old = { ...payment, document: frozen };
    const parsed = paymentRecordSchema.parse(old);
    expect(hasStoredDocumentPresentation({ payments: [old] })).toBe(true);
    expect(hasStoredDocumentPresentation({ payments: [parsed] })).toBe(false);
    expect(parsed.document).toEqual(recordDocumentData(frozen));
    expect(JSON.stringify(parsed.document)).not.toContain('data:image');
    const state = saveDocumentTemplates(
      { ...initial, payments: [parsed], school: { ...initial.school, name: 'Updated School' } },
      {
        ...documentTemplatesFor(initial),
        branding: { logo: image, header: image, footer: image, signature: image, stamp: image },
        feeReceipt: { templateId: 'ribbon', accent: '#123456' },
        salarySlip: { templateId: 'minimal', accent: '#654321' },
      },
    );
    const current = feeReceiptFor(state, parsed);
    expect(current).toMatchObject({
      schoolName: 'Updated School',
      branding: { header: image, footer: image, signature: image, stamp: image },
      template: { templateId: 'ribbon', accent: '#123456' },
      amount: payment.amount,
      number: frozen.number,
    });
    const raw = JSON.stringify(parsed);
    const removed = saveDocumentTemplates(state, {
      ...documentTemplatesFor(state),
      branding: { logo: null, header: null, footer: null, signature: null, stamp: null },
    });
    expect(feeReceiptFor(removed, parsed).branding).toEqual({
      logo: null,
      header: null,
      footer: null,
      signature: null,
      stamp: null,
    });
    expect(JSON.stringify(parsed)).toBe(raw);
    expect(documentWithBranding(state, frozen).template.templateId).toBe('ribbon');
    const restored = restoreSchoolState(initial, { ...initial, payments: [old] });
    expect(hasStoredDocumentPresentation(restored)).toBe(false);
  });
  it('saves data only on new fee and salary payments and regenerates salary and Finance previews', () => {
    let state = saveStaffMember(createSeed('2026-10-15'), defaultStaffPayroll, {
      name: 'Live Staff',
      designation: 'Helper',
      departmentId: 'department-support',
      phone: '',
      email: '',
      status: 'active',
      joinedOn: '2026-04-01',
      salary: { effectiveFrom: '2026-04', basic: 3800000, allowance: 0, bonus: 0, deduction: 0 },
    });
    state = recordStudentPayment(state, {
      enrollmentId: 'enr-001',
      amount: 100000,
      date: '2026-10-15',
      method: 'Cash',
      reference: '',
    });
    state = recordSalaryPayment(state, {
      staffId: state.staffMembers!.at(-1)!.id,
      month: '2026-10',
      date: '2026-10-15',
      method: 'Bank',
      reference: '',
    });
    const fee = state.payments.at(-1)!,
      salary = state.salaryPayments!.at(-1)!;
    expect(hasStoredDocumentPresentation(state)).toBe(false);
    expect(salaryPaymentSchema.parse(salary).document).toEqual(salary.document);
    const facts = JSON.stringify({ fee, salary });
    state = saveDocumentTemplates(state, {
      ...documentTemplatesFor(state),
      branding: { header: image, footer: image, signature: image, stamp: image },
      feeReceipt: { templateId: 'frame', accent: '#113355' },
      salarySlip: { templateId: 'sidebar', accent: '#335577' },
    });
    expect(feeReceiptFor(state, fee).template.templateId).toBe('frame');
    expect(salarySlipFor(state, salary)).toMatchObject({
      template: { templateId: 'sidebar', accent: '#335577' },
      branding: { header: image, footer: image },
      amount: salary.net,
      number: salary.slipNumber,
    });
    const entries = financeEntries(state, '2026-10-01', '2026-10-31', '2026-10-15');
    expect(entries.find((entry) => entry.id === salary.id)?.document.template.templateId).toBe(
      'sidebar',
    );
    expect(JSON.stringify({ fee, salary })).toBe(facts);
  });
});
