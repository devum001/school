import { createContext } from 'react';
import type { ReactNode } from 'react';
export interface StudentProfileBridgeValue {
  attendance: boolean;
  academics: boolean;
  fees: boolean;
  manage: boolean;
  manageMarks: boolean;
  feeSummary: {
    outstanding: number;
    paid: number;
    paymentCount: number;
    configured: boolean;
  } | null;
  feeContent: ReactNode;
  documentContent: ReactNode;
  edit: () => void;
  remove: () => void;
}
export const StudentProfileBridge = createContext<StudentProfileBridgeValue | null>(null);
