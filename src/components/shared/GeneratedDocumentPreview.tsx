import { useEffect, useMemo, useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { documentWithBranding } from '../../lib/documentData';
import type { GeneratedDocument } from '../../types/ledger';
import { Button } from '../ui/Primitives';
import {
  documentPng,
  downloadDocumentPdf,
  printGeneratedDocument,
} from '../../lib/documentRendering';
import { communicationError } from '../../lib/communication';
import { money } from '../../lib/config';
export default function GeneratedDocumentPreview({
  data,
  compact = false,
  actions = true,
  brandingMode = 'school',
}: {
  data: GeneratedDocument;
  compact?: boolean;
  actions?: boolean;
  brandingMode?: 'school' | 'draft';
}) {
  const state = useSchool();
  const renderedData = useMemo(
    () => (brandingMode === 'draft' ? data : documentWithBranding(state, data)),
    [state, data, brandingMode],
  );
  const [image, setImage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    documentPng(renderedData, compact ? 480 : 1600)
      .then((value) => {
        if (current) {
          setImage(value);
          setError('');
        }
      })
      .catch((cause) => {
        if (current) setError(communicationError(cause));
      });
    return () => {
      current = false;
    };
  }, [renderedData, compact]);
  const act = async (print: boolean) => {
    setBusy(true);
    try {
      if (print) await printGeneratedDocument(renderedData);
      else await downloadDocumentPdf(renderedData);
      setError('');
    } catch (cause) {
      setError(communicationError(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`generated-document ${compact ? 'compact' : ''}`}>
      {image ? (
        <img
          src={image}
          alt={`${data.kind} preview — ${data.recipientName} — ${money(data.amount)}`}
        />
      ) : (
        <p role="status">Preparing {data.kind.toLowerCase()}…</p>
      )}
      {!compact && (
        <details>
          <summary>Document details</summary>
          <dl>
            <div>
              <dt>Document number</dt>
              <dd>{data.number}</dd>
            </div>
            {data.fields.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
            <div>
              <dt>{data.amountLabel}</dt>
              <dd>{money(data.amount)}</dd>
            </div>
          </dl>
        </details>
      )}
      {actions && (
        <div className="modal-actions">
          <Button variant="secondary" disabled={busy || !image} onClick={() => void act(true)}>
            Print {data.kind}
          </Button>
          <Button disabled={busy || !image} onClick={() => void act(false)}>
            Download {data.kind}
          </Button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
