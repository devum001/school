import { useCallback, useState } from 'react';
import { Button, LoadingOverlay, Panel, StatCard } from '../../components/ui/Primitives';
import {
  platformService,
  type PlatformSchool,
} from '../../services/platformService';
import { useRemote } from '../live/useRemote';
import SubscriptionModal from './SubscriptionModal';
import PlatformRevenueModal from './PlatformRevenueModal';

const PLAN_BADGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  starter: { bg: '#eff8ff', text: '#175cd3', dot: '#2e90fa' },
  pro: { bg: '#ecfdf3', text: '#027a48', dot: '#12b76a' },
  enterprise: { bg: '#fdf2fa', text: '#c11574', dot: '#ee46bc' },
  none: { bg: '#f2f4f7', text: '#475467', dot: '#98a2b3' },
};

export default function PlatformOverview() {
  const load = useCallback((signal: AbortSignal) => platformService.stats(signal), []);
  const state = useRemote(load);

  const [search, setSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<PlatformSchool | null>(null);
  const [showRevenueModal, setShowRevenueModal] = useState(false);

  if (state.loading) {
    return (
      <LoadingOverlay
        loading
        size="xl"
        label="Loading platform analytics…"
        message="Loading platform analytics…"
      >
        <div style={{ minHeight: 280 }} />
      </LoadingOverlay>
    );
  }

  if (state.error || !state.data) {
    return (
      <Panel>
        <h2>Platform Analytics Unavailable</h2>
        <p role="alert">{state.error || 'Failed to load stats'}</p>
        <Button onClick={state.reload}>Retry analytics</Button>
      </Panel>
    );
  }

  const { summary, monthlyGrowth, schoolDirectory, schoolSubscriptions } = state.data;

  const filteredSchools = schoolDirectory.filter((school) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      school.name.toLowerCase().includes(term) ||
      (school.code && school.code.toLowerCase().includes(term)) ||
      (school.city && school.city.toLowerCase().includes(term)) ||
      (school.principalName && school.principalName.toLowerCase().includes(term))
    );
  });

  const maxGrowthCount = Math.max(...monthlyGrowth.map((g) => g.count), 1);
  const realPlatformRevenue = summary.subscriptionRevenue ?? summary.totalRevenue ?? 0;
  const subscribedCount = summary.subscribedSchoolsCount ?? schoolSubscriptions?.filter((s) => s.hasPlan).length ?? 0;

  return (
    <>
      {/* 4 StatCards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard
          label="Total Schools"
          value={summary.totalSchools}
          detail={`${summary.activeSchools} active · ${summary.suspendedSchools} suspended`}
        />
        <StatCard
          label="Total Students"
          value={summary.totalStudents.toLocaleString('en-IN')}
          detail="Enrolled across all registered schools"
        />
        <StatCard
          label="Total Staff & Teachers"
          value={summary.totalStaff.toLocaleString('en-IN')}
          detail="Active teaching & non-teaching staff"
        />

        {/* Clickable Real Platform Revenue Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowRevenueModal(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setShowRevenueModal(true);
          }}
          style={{
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            borderRadius: 12,
            outline: 'none',
          }}
          title="Click to view school-by-school subscription revenue ledger"
        >
          <StatCard
            label="Total Platform Revenue"
            value={`₹${realPlatformRevenue.toLocaleString('en-IN')}`}
            detail={`${subscribedCount} of ${summary.totalSchools} schools subscribed · Click for details ↗`}
          />
        </div>
      </div>

      {/* Monthly School Registration Growth Chart */}
      <Panel
        title="School Registration Growth"
        subtitle="New school onboarding trend over the last 6 months"
      >
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 16,
              height: 140,
              paddingBottom: 8,
              borderBottom: '1px solid #eaecf0',
            }}
          >
            {monthlyGrowth.map((item) => {
              const heightPercent = Math.max(12, Math.round((item.count / maxGrowthCount) * 100));
              return (
                <div
                  key={item.label}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: item.count > 0 ? '#1b4332' : '#98a2b3',
                      marginBottom: 6,
                    }}
                  >
                    {item.count}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 42,
                      height: `${heightPercent}%`,
                      background: item.count > 0 ? '#2d6a4f' : '#eaecf0',
                      borderRadius: '6px 6px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: '#667085',
                      marginTop: 8,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      {/* School Directory & Campus Strength Table */}
      <div style={{ marginTop: 24 }}>
        <Panel
          title="School Directory & Campus Strength"
          subtitle="Live strength, subscription tier, and platform status for each campus"
          action={
            <div style={{ width: 280 }}>
              <input
                type="text"
                placeholder="Filter by name, code, city..."
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
            <div className="live-table-wrap">
              <table className="live-table">
                <thead>
                  <tr>
                    <th scope="col">School Name & Code</th>
                    <th scope="col">Location / City</th>
                    <th scope="col">Principal</th>
                    <th scope="col">Students</th>
                    <th scope="col">Staff</th>
                    <th scope="col">Subscription Plan</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchools.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: '#667085' }}>
                        No schools match your search query.
                      </td>
                    </tr>
                  ) : (
                    filteredSchools.map((school) => {
                      const planKey = school.subscription?.plan || 'starter';
                      const planStyle = PLAN_BADGE_COLORS[planKey] || PLAN_BADGE_COLORS.starter;
                      return (
                        <tr key={school.id}>
                          <th scope="row">
                            <div>
                              <strong>{school.name}</strong>
                              {school.code && (
                                <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>
                                  Code: {school.code}
                                </div>
                              )}
                            </div>
                          </th>
                          <td>{school.city || '—'}</td>
                          <td>{school.principalName || '—'}</td>
                          <td>
                            <strong>{school.studentCount}</strong> students
                          </td>
                          <td>
                            <strong>{school.staffCount}</strong> staff
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '3px 8px',
                                borderRadius: 12,
                                fontSize: 12,
                                fontWeight: 500,
                                background: planStyle.bg,
                                color: planStyle.text,
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: planStyle.dot,
                                }}
                              />
                              {planKey.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '3px 8px',
                                borderRadius: 12,
                                fontSize: 12,
                                fontWeight: 500,
                                background: school.status === 'active' ? '#ecfdf3' : '#fef3f2',
                                color: school.status === 'active' ? '#027a48' : '#b42318',
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: school.status === 'active' ? '#12b76a' : '#f04438',
                                }}
                              />
                              {school.status === 'active' ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td>
                            <Button
                              variant="secondary"
                              onClick={() => setSelectedSchool(school)}
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
      </div>

      {/* Subscription Edit Modal */}
      {selectedSchool && (
        <SubscriptionModal
          school={selectedSchool}
          onClose={() => setSelectedSchool(null)}
          onSaved={() => {
            setSelectedSchool(null);
            state.reload();
          }}
        />
      )}

      {/* Real Platform Revenue Breakdown Modal */}
      {showRevenueModal && (
        <PlatformRevenueModal
          subscriptions={schoolSubscriptions || []}
          allSchools={schoolDirectory}
          totalRevenue={realPlatformRevenue}
          onClose={() => setShowRevenueModal(false)}
          onManagePlan={(school) => {
            setShowRevenueModal(false);
            setSelectedSchool(school);
          }}
        />
      )}
    </>
  );
}
