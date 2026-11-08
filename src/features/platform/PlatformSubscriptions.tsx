import { useCallback, useState } from 'react';
import {
  Button,
  LoadingOverlay,
  Panel,
  StatCard,
  Badge,
} from '../../components/ui/Primitives';
import {
  platformService,
  type PlatformSchool,
} from '../../services/platformService';
import { useRemote } from '../live/useRemote';
import SubscriptionModal from './SubscriptionModal';

export default function PlatformSubscriptions() {
  const load = useCallback((signal: AbortSignal) => platformService.stats(signal), []);
  const state = useRemote(load);

  const [filter, setFilter] = useState<'all' | 'subscribed' | 'unsubscribed'>('all');
  const [search, setSearch] = useState('');
  const [editingSchool, setEditingSchool] = useState<PlatformSchool | null>(null);

  if (state.loading) {
    return (
      <LoadingOverlay
        loading
        size="xl"
        label="Loading subscription records…"
        message="Loading subscription records…"
      >
        <div style={{ minHeight: 320 }} />
      </LoadingOverlay>
    );
  }

  if (state.error || !state.data) {
    return (
      <Panel>
        <h2>Subscriptions Unavailable</h2>
        <p role="alert">{state.error || 'Failed to load subscription data'}</p>
        <Button onClick={state.reload}>Retry</Button>
      </Panel>
    );
  }

  const { summary, schoolSubscriptions = [], schoolDirectory = [] } = state.data;
  const totalRevenue = summary.subscriptionRevenue ?? summary.totalRevenue ?? 0;
  const subscribedCount = summary.subscribedSchoolsCount ?? schoolSubscriptions.filter((s) => s.hasPlan).length;
  const unsubscribedCount = summary.unsubscribedSchoolsCount ?? schoolSubscriptions.filter((s) => !s.hasPlan).length;

  const filtered = schoolSubscriptions.filter((s) => {
    if (filter === 'subscribed' && !s.hasPlan) return false;
    if (filter === 'unsubscribed' && s.hasPlan) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.schoolName.toLowerCase().includes(q) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q)) ||
      s.plan.toLowerCase().includes(q)
    );
  });

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <>
      {/* Top 4 KPI Metrics */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard
          label="Total Platform Revenue"
          value={`₹${totalRevenue.toLocaleString('en-IN')}`}
          detail="Collected software subscription fees"
          tone="green"
        />
        <StatCard
          label="Paid & Subscribed"
          value={`${subscribedCount} schools`}
          detail="Active paid SaaS tiers"
          tone="blue"
        />
        <StatCard
          label="Unsubscribed / Expired"
          value={`${unsubscribedCount} schools`}
          detail="No active paid plan"
          tone="neutral"
        />
        <StatCard
          label="Annual Run Rate (ARR)"
          value={`₹${totalRevenue.toLocaleString('en-IN')}`}
          detail="Annual recurring software pace"
          tone="purple"
        />
      </div>

      {/* Main Ledger Panel */}
      <Panel
        title="School Subscriptions & Revenue Ledger"
        subtitle="Real-time breakdown of software subscription plans, purchase dates, validity, and collection per campus."
        action={
          <div style={{ width: 280 }}>
            <input
              type="text"
              placeholder="Search school, code, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d0d5dd',
                fontSize: 13,
              }}
            />
          </div>
        }
      >
        <div className="live-content">
          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Button
              variant={filter === 'all' ? 'primary' : 'secondary'}
              onClick={() => setFilter('all')}
            >
              All Schools ({schoolSubscriptions.length})
            </Button>
            <Button
              variant={filter === 'subscribed' ? 'primary' : 'secondary'}
              onClick={() => setFilter('subscribed')}
            >
              Subscribed & Paid ({subscribedCount})
            </Button>
            <Button
              variant={filter === 'unsubscribed' ? 'primary' : 'secondary'}
              onClick={() => setFilter('unsubscribed')}
            >
              Unsubscribed / Expired ({unsubscribedCount})
            </Button>
          </div>

          {/* Full-width Clean Table */}
          <div className="live-table-wrap">
            <table className="live-table">
              <thead>
                <tr>
                  <th scope="col">School Campus</th>
                  <th scope="col">Location / City</th>
                  <th scope="col">Plan Tier</th>
                  <th scope="col">Purchased On</th>
                  <th scope="col">Renews / Valid Till</th>
                  <th scope="col">Status</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Revenue Collected</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: '#667085' }}>
                      No school subscription records found matching this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const matchingSchool = schoolDirectory.find((s) => s.id === item.schoolId);

                    const planBadgeTone =
                      item.plan === 'enterprise'
                        ? 'blue'
                        : item.plan === 'pro'
                        ? 'green'
                        : item.plan === 'starter'
                        ? 'amber'
                        : 'neutral';

                    const statusBadgeTone =
                      item.status === 'active'
                        ? 'green'
                        : item.status === 'grace_period'
                        ? 'amber'
                        : item.status === 'expired'
                        ? 'red'
                        : 'neutral';

                    return (
                      <tr key={item.schoolId}>
                        <th scope="row">
                          <div>
                            <strong>{item.schoolName}</strong>
                            {item.code && (
                              <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>
                                Code: {item.code}
                              </div>
                            )}
                          </div>
                        </th>
                        <td>{item.city || '—'}</td>
                        <td>
                          <Badge tone={planBadgeTone}>
                            ● {item.planLabel}
                          </Badge>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, color: '#344054' }}>
                            {formatDate(item.purchasedAt)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, color: '#344054' }}>
                            {formatDate(item.renewsAt)}
                          </span>
                        </td>
                        <td>
                          <Badge tone={statusBadgeTone}>
                            {item.status === 'active'
                              ? '● Paid & Active'
                              : item.status === 'grace_period'
                              ? '● Grace Period'
                              : item.status === 'expired'
                              ? '● Expired'
                              : '○ Unsubscribed'}
                          </Badge>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong style={{ color: item.amountPaid > 0 ? '#1b4332' : '#667085', fontSize: 14 }}>
                            {item.amountPaid > 0 ? `₹${item.amountPaid.toLocaleString('en-IN')}` : '₹0'}
                          </strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              if (matchingSchool) {
                                setEditingSchool(matchingSchool);
                              }
                            }}
                          >
                            Manage Plan
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

      {/* Subscription Modal for Editing */}
      {editingSchool && (
        <SubscriptionModal
          school={editingSchool}
          onClose={() => setEditingSchool(null)}
          onSaved={() => {
            setEditingSchool(null);
            state.reload();
          }}
        />
      )}
    </>
  );
}
