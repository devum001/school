import { useState } from 'react';
import { Button, LoadingOverlay, Panel } from '../../../components/ui/Primitives';
import { money } from '../../../lib/config';
import { downloadCsv } from '../../../lib/download';
import {
  feeOnboardingApi as api,
  type FeeDraftSummary,
} from '../../../services/feeOnboardingService';
import FeeDraftSettings from './FeeDraftSettings';

export default function FeeDraftReview({
  summary,
  schoolId,
  draft,
  today,
  disabled,
  busy,
  change,
  action,
  reportError,
  reviewProblems,
}: {
  summary: FeeDraftSummary;
  schoolId: string;
  draft: string;
  today: string;
  disabled: boolean;
  busy: boolean;
  change: (action: string, body: object) => Promise<unknown>;
  action: (name: string) => Promise<void>;
  reportError: (message: string) => void;
  reviewProblems: () => void;
}) {
  const { job, totals } = summary;
  const [exporting, setExporting] = useState(false);
  const exportProblems = async () => {
    setExporting(true);
    try {
      const issues: string[][] = [];
      for (let index = 1; ; index++) {
        const result = await api.rows(schoolId, draft, {
          filter: 'errors',
          page: index,
          export: true,
        });
        if (result.revision !== job.revision)
          throw new Error('The draft changed. Refresh before downloading problem rows.');
        result.items.forEach((r) => issues.push([r.code, r.name, r.error]));
        if (index * result.pageSize >= result.total) break;
      }
      downloadCsv('fee-setup-errors.csv', ['Admission Number', 'Student', 'Issue'], issues);
    } catch (e) {
      reportError(
        e instanceof Error ? e.message : 'Unable to download problem rows. Please retry.',
      );
    } finally {
      setExporting(false);
    }
  };
  return (
    <LoadingOverlay loading={exporting} label="Preparing problem rows…">
      <Panel title="Review the setup before activating">
        <div className="fee-draft-form">
          <p>
            New fees {money(totals.net)} − previously paid {money(totals.alreadyPaid)} + old dues{' '}
            {money(totals.oldDues)} ={' '}
            <strong>{money(Math.max(0, totals.net - totals.alreadyPaid + totals.oldDues))}</strong>{' '}
            outstanding from this setup. Previously recorded older accounts remain separate and
            unchanged.
          </p>
          <p>
            {totals.needsSetup} students still need a fee amount. {totals.errors} rows need
            correction. {totals.skipped} existing agreements will not be overwritten.
          </p>
          <FeeDraftSettings
            key={`${job.asOf}:${job.oldStart}:${job.oldEnd}`}
            job={job}
            today={today}
            disabled={disabled}
            save={(body) => change('settings', body)}
          />
          {job.status === 'ready' ? (
            <>
              <p>
                Validation is complete. Activation creates real student fee accounts. Existing
                payments will not be counted again.
              </p>
              <Button
                disabled={busy || totals.total === totals.skipped + totals.saved}
                onClick={() => void action('activate')}
              >
                Activate fees for this school
              </Button>
            </>
          ) : (
            <Button
              disabled={disabled || !!job.sheetErrors.length}
              onClick={() => void action('validate')}
            >
              Validate all students
            </Button>
          )}
          {totals.errors > 0 && (
            <Button variant="secondary" onClick={reviewProblems}>
              Review problem rows
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={busy || exporting || !totals.errors}
            onClick={() => void exportProblems()}
          >
            Download problem rows
          </Button>
        </div>
      </Panel>
    </LoadingOverlay>
  );
}
