import type { SetupStatus } from '../../services/schoolSetupService';
export function nextSetupStep(status: SetupStatus) {
  return status.steps.find((step) => step.required && step.status !== 'complete')?.key ?? 'review';
}
