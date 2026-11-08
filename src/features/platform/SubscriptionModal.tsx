import { useState } from 'react';
import { Button, Modal } from '../../components/ui/Primitives';
import {
  platformService,
  platformError,
  type PlatformSchool,
  type SchoolSubscription,
} from '../../services/platformService';

type Props = {
  school: PlatformSchool;
  onClose: () => void;
  onSaved: (updatedSchool: PlatformSchool) => void;
};

const PLAN_DETAILS = {
  starter: {
    label: 'Starter Plan',
    price: '₹18,000 / year',
    description: 'Core school operations, admissions, student records, and class timetables.',
  },
  pro: {
    label: 'Pro Plan',
    price: '₹36,000 / year',
    description: 'Includes teacher GPS punch, automated WhatsApp & SMS alerts, and fee management.',
  },
  enterprise: {
    label: 'Enterprise Plan',
    price: '₹72,000 / year',
    description: 'Unlimited access, online fee payment gateway, advanced payroll, and priority support.',
  },
};

export default function SubscriptionModal({ school, onClose, onSaved }: Props) {
  const currentSub: SchoolSubscription = school.subscription ?? {
    plan: 'starter',
    status: 'active',
    renewsAt: null,
    purchasedAt: null,
    features: {
      punchGps: true,
      whatsappAlerts: true,
      onlinePayments: true,
      advancedPayroll: true,
    },
  };

  const [plan, setPlan] = useState<'starter' | 'pro' | 'enterprise' | 'none'>(
    (currentSub.plan as any) || 'starter'
  );
  const [status, setStatus] = useState<'active' | 'grace_period' | 'expired' | 'unsubscribed'>(
    (currentSub.status as any) || 'active'
  );
  const [renewsAt, setRenewsAt] = useState<string>(
    currentSub.renewsAt ? currentSub.renewsAt.slice(0, 10) : ''
  );
  const [features, setFeatures] = useState({
    punchGps: currentSub.features?.punchGps ?? true,
    whatsappAlerts: currentSub.features?.whatsappAlerts ?? true,
    onlinePayments: currentSub.features?.onlinePayments ?? true,
    advancedPayroll: currentSub.features?.advancedPayroll ?? true,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const grantOneYear = () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setRenewsAt(nextYear.toISOString().slice(0, 10));
    setStatus('active');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await platformService.updateSubscription(school.id, {
        plan: status === 'unsubscribed' ? 'none' : (plan === 'none' ? 'starter' : plan),
        status,
        renewsAt: status === 'unsubscribed' ? undefined : (renewsAt ? new Date(renewsAt).toISOString() : undefined),
        features: status === 'unsubscribed' ? {
          punchGps: false,
          whatsappAlerts: false,
          onlinePayments: false,
          advancedPayroll: false,
        } : features,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(platformError(err));
    } finally {
      setBusy(false);
    }
  };

  const formattedPurchasedOn = currentSub.purchasedAt || school.createdAt;

  return (
    <Modal
      open
      title={`Subscription & Features · ${school.name}`}
      description="Assign paid subscription plan, renew validity, and customize feature access."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={handleSave} className="live-content">
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        {formattedPurchasedOn && (
          <div style={{ fontSize: 12, color: '#475467', marginBottom: 12, background: '#f8fafc', padding: '6px 12px', borderRadius: 6 }}>
            🗓️ <strong>Initial Purchase / Grant Date:</strong>{' '}
            {new Date(formattedPurchasedOn).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {(['starter', 'pro', 'enterprise'] as const).map((tierKey) => {
            const isSelected = plan === tierKey && status !== 'unsubscribed';
            const details = PLAN_DETAILS[tierKey];
            return (
              <div
                key={tierKey}
                onClick={() => {
                  setPlan(tierKey);
                  if (status === 'unsubscribed') setStatus('active');
                }}
                style={{
                  border: isSelected ? '2px solid #2d6a4f' : '1px solid #eaecf0',
                  background: isSelected ? '#f4fbf7' : '#ffffff',
                  borderRadius: 12,
                  padding: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 14, color: isSelected ? '#1b4332' : '#1f2937' }}>
                    {details.label}
                  </strong>
                  <input
                    type="radio"
                    name="planTier"
                    checked={isSelected}
                    onChange={() => {
                      setPlan(tierKey);
                      if (status === 'unsubscribed') setStatus('active');
                    }}
                  />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2d6a4f', marginTop: 4 }}>
                  {details.price}
                </div>
                <p style={{ fontSize: 11, color: '#667085', marginTop: 6, margin: 0, lineHeight: 1.4 }}>
                  {details.description}
                </p>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <label className="field">
            Subscription Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="active">Active (Full paid access)</option>
              <option value="grace_period">Grace Period (Renewal warning)</option>
              <option value="expired">Expired (Features suspended)</option>
              <option value="unsubscribed">Unsubscribed (No Plan / Revoke plan)</option>
            </select>
          </label>

          <label className="field">
            Renewal / Expiry Date
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="date"
                value={renewsAt}
                disabled={status === 'unsubscribed'}
                onChange={(e) => setRenewsAt(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={status === 'unsubscribed'}
                onClick={grantOneYear}
              >
                +1 Year
              </Button>
            </div>
          </label>
        </div>

        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>
            School Feature Switches
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={features.punchGps}
                disabled={status === 'unsubscribed'}
                onChange={(e) => setFeatures({ ...features, punchGps: e.target.checked })}
              />
              <span>
                <strong>GPS Teacher Punch</strong>
                <br />
                <small style={{ color: '#64748b' }}>Punch in/out within school premises</small>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={features.whatsappAlerts}
                disabled={status === 'unsubscribed'}
                onChange={(e) => setFeatures({ ...features, whatsappAlerts: e.target.checked })}
              />
              <span>
                <strong>WhatsApp / SMS Alerts</strong>
                <br />
                <small style={{ color: '#64748b' }}>Automated attendance & fee notices</small>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={features.onlinePayments}
                disabled={status === 'unsubscribed'}
                onChange={(e) => setFeatures({ ...features, onlinePayments: e.target.checked })}
              />
              <span>
                <strong>Online Fee Gateway</strong>
                <br />
                <small style={{ color: '#64748b' }}>UPI / Card payments for students</small>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={features.advancedPayroll}
                disabled={status === 'unsubscribed'}
                onChange={(e) => setFeatures({ ...features, advancedPayroll: e.target.checked })}
              />
              <span>
                <strong>Advanced Staff Payroll</strong>
                <br />
                <small style={{ color: '#64748b' }}>Salary advances, slips & deductions</small>
              </span>
            </label>
          </div>
        </div>

        <div className="live-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving...' : 'Grant & Save Subscription'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
