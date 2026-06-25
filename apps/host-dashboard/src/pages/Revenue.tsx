import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const monthlyData = [
  { month: 'Jan', gross: 12400, payout: 9920, platform: 2480 },
  { month: 'Feb', gross: 15800, payout: 12640, platform: 3160 },
  { month: 'Mar', gross: 18200, payout: 14560, platform: 3640 },
  { month: 'Apr', gross: 16500, payout: 13200, platform: 3300 },
  { month: 'May', gross: 22100, payout: 17680, platform: 4420 },
  { month: 'Jun', gross: 19800, payout: 15840, platform: 3960 },
];

const spaceBreakdown = [
  { name: 'T Nagar Spot A', value: 65 },
  { name: 'T Nagar Spot B', value: 25 },
  { name: 'Anna Nagar ML', value: 10 },
];

const COLORS = ['#38BDF8', '#22C55E', '#8B5CF6'];

const payouts = [
  { date: '2024-06-25', amount: 4320, status: 'Processed', bank: 'SBI ***1234' },
  { date: '2024-05-25', amount: 3960, amount2: 3960, status: 'Processed', bank: 'SBI ***1234' },
  { date: '2024-04-25', amount: 3300, status: 'Processed', bank: 'SBI ***1234' },
];

export default function Revenue() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue</h1>
          <p className="page-subtitle">Earnings and payout overview</p>
        </div>
        <button className="btn btn-primary">Request Payout</button>
      </div>

      {/* Summary Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Earned (YTD)', value: '₹1,04,800', icon: '💰', color: '#22C55E', bg: '#22C55E20' },
          { label: 'Pending Payout', value: '₹3,960', icon: '⏳', color: '#F59E0B', bg: '#F59E0B20' },
          { label: 'Platform Fee (20%)', value: '₹20,960', icon: '📊', color: '#8B5CF6', bg: '#8B5CF620' },
          { label: 'Net Payout (80%)', value: '₹83,840', icon: '🏦', color: '#38BDF8', bg: '#38BDF820' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg }}>{s.icon}</div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Revenue Chart */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            Monthly Earnings Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748B', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#F8FAFC' }} />
              <Bar dataKey="payout" name="Your Payout" fill="#22C55E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="platform" name="Platform Fee" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Space Breakdown */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            Revenue by Space
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={spaceBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                {spaceBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} />
              <Legend wrapperStyle={{ color: '#94A3B8', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payout History */}
      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
          Payout History
        </h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Bank Account</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map(p => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td style={{ color: 'var(--green)', fontWeight: 700 }}>₹{p.amount.toLocaleString()}</td>
                <td>{p.bank}</td>
                <td><span className="badge badge-green">{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
