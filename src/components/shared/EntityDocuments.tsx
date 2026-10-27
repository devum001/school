import { displayTimestamp } from '../../lib/displayFormat';
import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, EmptyState, Modal, Panel, AppIcon, LoadingOverlay } from '../ui/Primitives';
import { STAFF_DOCUMENT_CATEGORIES, STUDENT_DOCUMENT_CATEGORIES } from '../../lib/entityDocuments';
import { downloadStoredDocument, readDocumentFile } from '../../lib/fileUploads';
import { communicationError } from '../../lib/communication';
import { repository } from '../../lib/repository';
import type { StoredDocument } from '../../types/ledger';

export interface DocumentAdapter {
  documents: StoredDocument[];
  canManage: boolean;
  load: (id: string) => Promise<StoredDocument>;
  save: (
    input: Pick<StoredDocument, 'category' | 'fileName' | 'mimeType' | 'size' | 'dataUrl'>,
  ) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}
export default function EntityDocuments({
  ownerKind,
  ownerId,
  adapter,
}: {
  adapter?: DocumentAdapter;
  ownerKind: StoredDocument['ownerKind'];
  ownerId: string;
}) {
  const state = useSchool(),
    notify = useFeedback();
  const categories =
    ownerKind === 'staff' ? STAFF_DOCUMENT_CATEGORIES : STUDENT_DOCUMENT_CATEGORIES;
  const [category, setCategory] = useState<string>(categories[0]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [removing, setRemoving] = useState<StoredDocument | null>(null),
    [viewing, setViewing] = useState<StoredDocument | null>(null);
  const documents =
    adapter?.documents ??
    (state.documents ?? []).filter(
      (entry) =>
        entry.schoolId === state.school.id &&
        entry.ownerKind === ownerKind &&
        entry.ownerId === ownerId,
    );
  const openDocument = async (entry: StoredDocument, download = false) => {
    setBusy(true);
    setError('');
    try {
      const file = adapter ? await adapter.load(entry.id) : entry;
      if (download) downloadStoredDocument(file.dataUrl, file.fileName);
      else setViewing(file);
    } catch (cause) {
      setError(communicationError(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="Documents"
      subtitle="ID proofs, certificates and other files belonging to this record."
    >
      <LoadingOverlay loading={busy} label="Updating student documents…">
        <div />
      </LoadingOverlay>
      <div className="panel-padding">
        {(!adapter || adapter.canManage) && (
          <div className="document-upload-toolbar">
            <label className="field">
              Document category
              <select
                aria-label="Document category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="button secondary document-upload-control">
              <AppIcon name="upload" size={16} /> {busy ? 'Saving…' : 'Upload document'}
              <input
                aria-label="Upload document"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setBusy(true);
                  setError('');
                  try {
                    const upload = {
                      ownerKind,
                      ownerId,
                      category,
                      ...(await readDocumentFile(file)),
                    };
                    if (adapter) await adapter.save(upload);
                    else repository.saveEntityDocument(upload);
                    notify('Document saved.');
                  } catch (cause) {
                    setError(communicationError(cause));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          </div>
        )}
        <p className="panel-note">PDF, PNG, JPEG or WebP · Up to 2 MB per file.</p>
        {documents.length ? (
          <div className="table-wrap" role="region" aria-label="Uploaded documents" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Category</th>
                  <th scope="col">Uploaded</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((entry) => (
                  <tr key={entry.id}>
                    <th scope="row">
                      <button className="text-link" onClick={() => void openDocument(entry)}>
                        {entry.fileName}
                      </button>
                    </th>
                    <td>{entry.category}</td>
                    <td>{displayTimestamp(entry.uploadedAt)}</td>
                    <td>
                      <div className="inline-actions">
                        <Button
                          variant="ghost"
                          aria-label={`Download ${entry.fileName}`}
                          onClick={() => void openDocument(entry, true)}
                        >
                          <AppIcon name="download" size={15} /> Download
                        </Button>
                        {(!adapter || adapter.canManage) && (
                          <Button
                            variant="ghost"
                            aria-label={`Delete ${entry.fileName}`}
                            onClick={() => setRemoving(entry)}
                          >
                            <AppIcon name="delete" size={15} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No documents uploaded"
            description="Upload an existing ID proof, certificate or other document."
            icon={<AppIcon name="document" size={36} />}
          />
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.fileName ?? 'Document'}
        description={viewing?.category ?? 'Saved document'}
      >
        {viewing?.mimeType.startsWith('image/') ? (
          <img className="entity-document-image" src={viewing.dataUrl} alt={viewing.fileName} />
        ) : (
          <p>PDF document · {Math.ceil((viewing?.size ?? 0) / 1024)} KB</p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Close
          </Button>
          <Button
            onClick={() => viewing && downloadStoredDocument(viewing.dataUrl, viewing.fileName)}
          >
            Download document
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Delete document?"
        description={`Remove ${removing?.fileName ?? 'this file'} from this record.`}
      >
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Keep document
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              setBusy(true);
              try {
                if (removing) {
                  if (adapter) await adapter.remove(removing.id);
                  else repository.deleteEntityDocument(removing.id);
                }
                setRemoving(null);
                notify('Document deleted.');
              } catch (cause) {
                setError(communicationError(cause));
                setRemoving(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete document
          </Button>
        </div>
      </Modal>
    </Panel>
  );
}
