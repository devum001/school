import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, EmptyState, Modal, Panel, AppIcon } from '../ui/Primitives';
import { STAFF_DOCUMENT_CATEGORIES, STUDENT_DOCUMENT_CATEGORIES } from '../../lib/entityDocuments';
import { downloadStoredDocument, readDocumentFile } from '../../lib/fileUploads';
import { communicationError } from '../../lib/communication';
import { repository } from '../../lib/repository';
import type { StoredDocument } from '../../types/ledger';

export default function EntityDocuments({
  ownerKind,
  ownerId,
}: {
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
  const documents = (state.documents ?? []).filter(
    (entry) =>
      entry.schoolId === state.school.id &&
      entry.ownerKind === ownerKind &&
      entry.ownerId === ownerId,
  );
  return (
    <Panel
      title="Documents"
      subtitle="ID proofs, certificates and other files belonging to this record."
    >
      <div className="panel-padding">
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
                  repository.saveEntityDocument({
                    ownerKind,
                    ownerId,
                    category,
                    ...(await readDocumentFile(file)),
                  });
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
        <p className="panel-note">PDF, PNG, JPEG or WebP · Up to 2 MB per file.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
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
                      <button className="text-link" onClick={() => setViewing(entry)}>
                        {entry.fileName}
                      </button>
                    </th>
                    <td>{entry.category}</td>
                    <td>
                      {new Date(entry.uploadedAt).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}
                    </td>
                    <td>
                      <div className="inline-actions">
                        <Button
                          variant="ghost"
                          aria-label={`Download ${entry.fileName}`}
                          onClick={() => downloadStoredDocument(entry.dataUrl, entry.fileName)}
                        >
                          <AppIcon name="download" size={15} /> Download
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={`Delete ${entry.fileName}`}
                          onClick={() => setRemoving(entry)}
                        >
                          <AppIcon name="delete" size={15} />
                        </Button>
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
            onClick={() => {
              try {
                if (removing) repository.deleteEntityDocument(removing.id);
                setRemoving(null);
                notify('Document deleted.');
              } catch (cause) {
                setError(communicationError(cause));
                setRemoving(null);
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
