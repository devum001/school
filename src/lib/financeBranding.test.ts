import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import { documentLayout, rectanglesOverlap } from './documentLayout';
import {
  documentTemplatesFor,
  designChoice,
  saveDocumentTemplates,
  documentWithBranding,
} from './documentData';
import { recordStudentPayment, recordSalaryPayment } from './financeTransactions';
import { saveFeePlan } from './feePlans';
import { roster } from './selectors';
import { financeEntries } from './financeLedger';
import { schoolMonthlyFinance } from './schoolFinance';
import { schoolLogoFor } from './schoolBranding';
import { saveSchoolProfile } from './settings';
import { defaultStaffPayroll } from './settings';
import { saveStaffMember } from './staffStructure';
import { TEMPLATE_IDS, documentTemplatesSchema, generatedDocumentSchema } from './ledgerSchemas';
const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3XkAAAAASUVORK5CYII=';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-14T06:30:00Z'));
});
afterEach(() => vi.useRealTimers());
describe('document branding and individual design colors', () => {
  it('provides sample artwork without replacing existing logos and keeps Templates and General in sync', () => {
    const seed = createSeed();
    expect(Object.values(documentTemplatesFor(seed).branding!).every(Boolean)).toBe(true);
    const custom = { ...seed, school: { ...seed.school, logoDataUrl: image } };
    expect(schoolLogoFor(custom)).toBe(image);
    const imported = saveDocumentTemplates(seed, {
      ...documentTemplatesFor(seed),
      branding: { ...documentTemplatesFor(seed).branding, logo: image },
    });
    expect(imported.school.logoDataUrl).toBe(image);
    expect(schoolLogoFor(imported)).toBe(image);
    const cleared = saveSchoolProfile(imported, { ...imported.school, logoDataUrl: null });
    expect(schoolLogoFor(cleared)).toBeUndefined();
    expect(documentTemplatesFor(cleared).branding?.logo).toBeNull();
  });
  it('keeps every asset box away from text and from each other for all twelve layouts', () => {
    for (const kind of ['Fee Receipt', 'Salary Slip'] as const)
      for (const id of TEMPLATE_IDS) {
        const layout = documentLayout(kind, id),
          zones = [
            layout.header,
            layout.identity,
            layout.title,
            layout.fields,
            layout.amount,
            layout.signature,
            layout.stamp,
            layout.footer,
          ];
        for (let a = 0; a < zones.length; a++)
          for (let b = a + 1; b < zones.length; b++)
            expect(rectanglesOverlap(zones[a], zones[b]), `${kind}/${id}/${a}/${b}`).toBe(false);
        expect(layout.footer.y + layout.footer.height).toBeLessThan(1697);
      }
  });
  it('preserves the old selected color and independently saves each new design color', () => {
    const seed = createSeed(),
      old = {
        ...seed,
        documentTemplates: {
          feeReceipt: { templateId: 'classic' as const, accent: '#123456' },
          salarySlip: { templateId: 'ledger' as const, accent: '#654321' },
        },
      };
    const config = documentTemplatesFor(old);
    expect(designChoice(config.feeReceipt, 'classic').accent).toBe('#123456');
    const originalRibbon = designChoice(config.feeReceipt, 'ribbon').accent,
      originalSalary = designChoice(config.salarySlip, 'ribbon').accent;
    const saved = saveDocumentTemplates(old, {
      ...config,
      feeReceipt: {
        ...config.feeReceipt,
        colors: { ...config.feeReceipt.colors, minimal: '#abcdef' },
      },
    });
    expect(designChoice(documentTemplatesFor(saved).feeReceipt, 'ribbon').accent).toBe(
      originalRibbon,
    );
    expect(designChoice(documentTemplatesFor(saved).salarySlip, 'ribbon').accent).toBe(
      originalSalary,
    );
    expect(designChoice(documentTemplatesFor(saved).feeReceipt, 'minimal').accent).toBe('#abcdef');
    expect(documentTemplatesSchema.parse(saved.documentTemplates).feeReceipt.colors?.minimal).toBe(
      '#abcdef',
    );
  });
  it('stores payment facts without artwork and resolves current letterhead for every reprint', () => {
    const seed = createSeed(),
      row = roster(seed)[0],
      branding = { logo: image, header: image, footer: image, signature: image, stamp: image };
    let state = saveFeePlan({ ...seed, payments: [], obligations: [] }, row.enrollment.id, {
      kind: 'One Time',
      totalFee: 100000,
      installments: [{ amount: 100000, dueDate: '2026-10-14' }],
    });
    state = saveDocumentTemplates(state, { ...documentTemplatesFor(state), branding });
    state = recordStudentPayment(state, {
      enrollmentId: row.enrollment.id,
      amount: 100000,
      date: '2026-10-14',
      method: 'Cash',
      reference: '',
    });
    const document = state.payments[0].document!;
    expect(document).not.toHaveProperty('branding');
    expect(generatedDocumentSchema.parse(documentWithBranding(state, document)).schoolLogo).toBe(
      image,
    );
    const changed = saveDocumentTemplates(state, {
      ...documentTemplatesFor(state),
      branding: { header: null, footer: null, signature: null, stamp: null },
    });
    expect(documentWithBranding(changed, document).branding?.header).toBeNull();
    expect(documentWithBranding(state, document)).toMatchObject({
      branding,
      amount: 100000,
      number: document.number,
    });
  });
});
describe('connected cash revenue and salary expenses', () => {
  it('counts received fees and paid salary once, excludes pending plans and future/foreign payments, and matches transactions', () => {
    let state = createSeed('2026-10-14');
    const row = roster(state)[0];
    state = saveFeePlan({ ...state, payments: [], obligations: [] }, row.enrollment.id, {
      kind: 'One Time',
      totalFee: 10000000,
      installments: [{ amount: 10000000, dueDate: '2026-10-18' }],
    });
    state = saveStaffMember(state, defaultStaffPayroll, {
      name: 'Finance Staff',
      departmentId: 'department-support',
      designation: 'Helper',
      email: '',
      phone: '',
      status: 'active',
      joinedOn: '2026-01-01',
      salary: { effectiveFrom: '2026-01', basic: 2000000, allowance: 0, bonus: 0, deduction: 0 },
    });
    const member = state.staffMembers![0];
    expect(schoolMonthlyFinance(state, defaultStaffPayroll, '2026-10-14').paidSalary).toBe(0);
    state = recordStudentPayment(state, {
      enrollmentId: row.enrollment.id,
      amount: 3000000,
      date: '2026-10-14',
      method: 'UPI',
      reference: '',
    });
    state = recordSalaryPayment(state, {
      staffId: member.id,
      month: '2026-10',
      date: '2026-10-14',
      method: 'Bank',
      reference: '',
    });
    state = {
      ...state,
      payments: [
        ...state.payments,
        { ...state.payments[0], id: 'foreign', schoolId: 'foreign', amount: 99000000 },
        { ...state.payments[0], id: 'future', date: '2026-10-15', amount: 99000000 },
      ],
    };
    const totals = schoolMonthlyFinance(state, defaultStaffPayroll, '2026-10-14'),
      entries = financeEntries(state, totals.cycle.start, totals.cycle.end, '2026-10-14');
    expect(totals).toMatchObject({
      feeIncome: 3000000,
      paidSalary: 2000000,
      balanceAfterPaidSalary: 1000000,
    });
    expect(entries).toHaveLength(2);
    expect(entries.reduce((sum, e) => sum + e.income - e.expense, 0)).toBe(
      totals.balanceAfterPaidSalary,
    );
    expect(
      schoolMonthlyFinance(state, defaultStaffPayroll, '2026-09-30', '2026-09').feeIncome,
    ).toBe(0);
  });
});
