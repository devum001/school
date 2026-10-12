import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Badge, Panel } from '../../components/ui/Primitives';
import type { attendanceSummary } from '../../lib/selectors';
export function AttendanceTrend({
  attendance,
  trend,
}: {
  attendance: ReturnType<typeof attendanceSummary>;
  trend: { date: string; attendance: number }[];
}) {
  return (
    <Panel
      title="Every school day counts"
      subtitle="Attendance rate · last seven recorded school days"
      action={<Badge tone="green">{attendance.percentage}% selected day</Badge>}
    >
      <div className="chart-heading">
        <strong>
          {attendance.percentage}
          <span>%</span>
        </strong>
        <p>
          Attending ÷ marked students
          <br />
          <span>Includes late and half-day attendance</span>
        </p>
      </div>
      <div
        className="attendance-chart"
        role="img"
        aria-label={`Attendance rate over ${trend.length} recorded days`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 10, right: 20, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#287e69" stopOpacity={0.17} />
                <stop offset="95%" stopColor="#287e69" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e8edf0" strokeDasharray="4 4" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#607187' }}
              dy={8}
            />
            <YAxis
              domain={[70, 100]}
              ticks={[70, 80, 90, 100]}
              tickFormatter={(n) => `${n}%`}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#607187' }}
            />
            <Tooltip
              formatter={(value) => [`${value}%`, 'Attendance']}
              contentStyle={{ border: '1px solid #e4e9ef', borderRadius: 8, fontSize: 12 }}
            />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="attendance"
              stroke="#2a806c"
              strokeWidth={2.5}
              fill="url(#attendanceFill)"
              dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-foot">
        <span>
          <i className="legend-dot green" />
          Attendance rate
        </span>
        <span>
          {attendance.marked} marked of {attendance.total} enrolled · {attendance.unmarked} not
          marked
        </span>
      </div>
    </Panel>
  );
}
