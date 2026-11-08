import { useState, useMemo } from 'react';
import { Button, Modal, StatCard, Badge } from '../../components/ui/Primitives';
import {
  type SchoolSubscriptionRecord,
  type PlatformSchool,
} from '../../services/platformService';

type Props = {
  subscriptions: SchoolSubscriptionRecord[];
  allSchools: PlatformSchool[];
  totalRevenue: number;
  onClose: () => void;
  onManagePlan: (school: PlatformSchool) => void;
};

export default function PlatformRevenueModal({
  subscriptions,
  allSchools,
  totalRevenue,
  onClose,
  onManagePlan,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'subscribed' | 'unsubscribed'>('all');
  const [search, setSearch] = useState('');

  const subscribedCount = subscriptions.filter((s) => s.hasPlan).length;
  const unsubscribedCount = subscriptions.filter((s) => !s.hasPlan).length;

  const filtered = useMemo(() => {
    return subscriptions.filter((s) => {
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
  }, [subscriptions, filter, search]);

  const avgRevenue =
    subscribedCount > 0 ? Math.round(totalRevenue / subscribedCount) : 0;

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
    <Modal
      open
      title="Platform Revenue & School Subscriptions"
      description="Breakdown of software subscription earnings and real-time plan status for every registered school."
      onClose={onClose}
    >
      <div style={{ minWidth: 780, maxWidth: 960 }}>
        {/* Top 4 KPI Metrics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard
            label="Total Platform Revenue"
            value={`₹${totalRevenue.toLocaleString('en-IN')}`}
            detail="Collected subscription fees"
          />
          <StatCard
            label="Paid & Subscribed"
            value={`${subscribedCount} schools`}
            detail="Active paid SaaS tiers"
          />
          <StatCard
            label="Unsubscribed / Expired"
            value={`${unsubscribedCount} schools`}
            detail="No active plan"
          />
          <StatCard
            label="Average / School"
            value={`₹${avgRevenue.toLocaleString('en-IN')}`}
            detail="Annual per-school average"
          />
        </div>

        {/* Filter Pills & Search */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant={filter === 'all' ? 'primary' : 'secondary'}
              onClick={() => setFilter('all')}
            >
              All Schools ({subscriptions.length})
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

          <div style={{ width: 260 }}>
            <input
              type="text"
              placeholder="Search by school, code, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #d0d5dd',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* Subscriptions Ledger Table */}
        <div className="live-table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="live-table">
            <thead>
              <tr>
                <th scope="col">School Campus</th>
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: '#667085' }}>
                    No school subscription records found matching this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const matchingSchool = allSchools.find((s) => s.id === item.schoolId);

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
                          <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>
                            {item.code ? `Code: ${item.code}` : ''}
                            {item.city ? ` · ${item.city}` : ''}
                          </div>
                        </div>
                      </th>
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
                        <strong style={{ color: item.amountPaid > 0 ? '#1b4332' : '#667085' }}>
                          {item.amountPaid > 0 ? `₹${item.amountPaid.toLocaleString('en-IN')}` : '₹0'}
                        </strong>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            if (matchingSchool) {
                              onManagePlan(matchingSchool);
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

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
