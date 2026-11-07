import { useCallback, useState } from 'react';
import { Button, LoadingOverlay, Panel, StatCard } from '../../components/ui/Primitives';
import {
  platformService,
  type PlatformSchool
} from '../../services/platformService';
import { useRemote } from '../live/useRemote';
import SubscriptionModal from './SubscriptionModal';

const PLAN_BADGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  starter: { bg: '#eff8ff', text: '#175cd3', dot: '#2e90fa' },
  pro: { bg: '#ecfdf3', text: '#027a48', dot: '#12b76a' },
  enterprise: { bg: '#fdf2fa', text: '#c11574', dot: '#ee46bc' },
};

export default function PlatformOverview() {
  const load = useCallback((signal: AbortSignal) => platformService.stats(signal), []);
  const state = useRemote(load);

  const [search, setSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<PlatformSchool | null>(null);

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

  const { summary, monthlyGrowth, schoolDirectory } = state.data;

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
        <StatCard
          label="Total Platform Revenue"
          value={`₹${summary.totalRevenue.toLocaleString('en-IN')}`}
          detail={`₹${summary.subscriptionRevenue.toLocaleString('en-IN')}/yr subscription rate`}
        />
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
                      backgroundColor: item.count > 0 ? '#2d6a4f' : '#e4e7ec',
                      borderRadius: '6px 6px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: '#475467',
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

      {/* Searchable School Directory & Strength Table */}
      <Panel
        title="School Directory & Campus Strength"
        subtitle="Live strength, subscription tier, and platform status for each campus"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ width: '100%', maxWidth: 360 }}>
            <input
              type="search"
              placeholder="Search school name, code, city, principal..."
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
          <span style={{ fontSize: 13, color: '#667085' }}>
            Showing {filteredSchools.length} of {schoolDirectory.length} schools
          </span>
        </div>

        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #eaecf0', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>SCHOOL</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>PRINCIPAL & CITY</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>STUDENTS</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>STAFF</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>PLAN TIER</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>STATUS</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#667085' }}>
                    No matching schools found.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((school) => {
                  const planKey = school.subscription?.plan || 'starter';
                  const badgeStyle = PLAN_BADGE_COLORS[planKey] || PLAN_BADGE_COLORS.starter;
                  return (
                    <tr
                      key={school.id}
                      style={{ borderBottom: '1px solid #f2f4f7' }}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ fontSize: 13, color: '#101828' }}>{school.name}</strong>
                        {school.code && (
                          <span style={{ marginLeft: 8, fontSize: 11, background: '#f2f4f7', padding: '2px 6px', borderRadius: 4, color: '#344054' }}>
                            {school.code}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#475467' }}>
                        {school.principalName ? school.principalName : '—'}
                        {school.city && <span style={{ color: '#98a2b3' }}> · {school.city}</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#101828' }}>
                        {school.studentCount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#101828' }}>
                        {school.staffCount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 600,
                            background: badgeStyle.bg,
                            color: badgeStyle.text,
                            padding: '3px 9px',
                            borderRadius: 12,
                            textTransform: 'capitalize',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: badgeStyle.dot,
                            }}
                          />
                          {planKey}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 500,
                            color: school.status === 'active' ? '#027a48' : '#b42318',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: school.status === 'active' ? '#12b76a' : '#f04438',
                            }}
                          />
                          {school.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
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
      </Panel>

      {/* Subscription Modal */}
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
    </>
  );
}
