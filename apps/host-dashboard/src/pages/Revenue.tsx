import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { hostApi } from '../utils/apiClient';
import { useListings, useRevenue } from '../hooks/useHostData';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const COLORS = ['#EF010C', '#10B981', '#8B5CF6', '#F59E0B'];

export default function Revenue() {
  useDocumentTitle('Revenue & Payouts');
  const { revenueStats, loading: revLoading, error: revError, refetch } = useRevenue();
  const { listings } = useListings();
  const [requesting, setRequesting] = useState(false);
  const [payoutError, setPayoutError] = useState('');

  const spaceBreakdown =
    listings.length > 0
      ? listings.map((l) => ({ name: l.name, value: Math.max(1, l.hourlyRate * l.totalCapacity) }))
      : [];

  const handleRequestPayout = async () => {
    setPayoutError('');
    if (revenueStats.availableBalance <= 0) {
      setPayoutError('No available payout balance at this time.');
      return;
    }
    if (!confirm(`Request payout of ₹${revenueStats.availableBalance.toLocaleString('en-IN')} to your registered bank account?`)) {
      return;
    }
    setRequesting(true);
    try {
      await hostApi.requestPayout({ amount: revenueStats.availableBalance });
      await refetch();
    } catch (err: any) {
      setPayoutError(err.response?.data?.error?.message || 'Unable to process payout request');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Revenue' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue &amp; Payouts</h1>
          <p className="page-subtitle">Monthly earnings breakdown, platform commission ledger, and bank payouts.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleRequestPayout}
          disabled={requesting || revLoading || revenueStats.availableBalance <= 0}
        >
          {requesting ? 'Processing...' : `Request Payout (₹${revenueStats.availableBalance.toLocaleString('en-IN')})`}
        </button>
      </div>

      {(revError || payoutError) && <div className="alert-error">{payoutError || revError}</div>}

      {/* Summary Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Earned', value: `₹${revenueStats.totalEarnings.toLocaleString('en-IN')}`, icon: '💰', color: '#10B981', bg: '#10B98120' },
          { label: 'Available Balance', value: `₹${revenueStats.availableBalance.toLocaleString('en-IN')}`, icon: '⏳', color: '#F59E0B', bg: '#F59E0B20' },
          { label: 'Platform Fee (10%)', value: `₹${revenueStats.platformFees.toLocaleString('en-IN')}`, icon: '📊', color: '#8B5CF6', bg: '#8B5CF620' },
          { label: 'Net Revenue', value: `₹${revenueStats.netRevenue.toLocaleString('en-IN')}`, icon: '🏦', color: '#EF010C', bg: 'rgba(239,1,12,0.15)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
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
          {revenueStats.monthlyBreakdown.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No completed earnings in period yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueStats.monthlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263957" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#111D33', border: '1px solid #263957', borderRadius: 8, color: '#F8FAFC' }} />
                <Bar dataKey="net" name="Host Payout" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fees" name="Platform Fee" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Space Capacity Value Breakdown */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            Earnings Capacity by Space
          </h3>
          {spaceBreakdown.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Add listings to compare space performance.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={spaceBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {spaceBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#111D33', border: '1px solid #263957', borderRadius: 8 }} />
                <Legend wrapperStyle={{ color: '#94A3B8', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Payout History */}
      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
          Payout History
        </h3>
        {revenueStats.recentPayouts.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No payout requests yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Requested</th>
                <th>Payout ID</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {revenueStats.recentPayouts.map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                  <td style={{ fontFamily: 'monospace' }}>#{p.id.slice(0, 8)}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 700 }}>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`badge badge-${p.status === 'completed' ? 'green' : p.status === 'failed' ? 'red' : 'yellow'}`}>
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
