import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { hostApi } from '../utils/apiClient';
import { useRevenue } from '../hooks/useHostData';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { CurrencyIcon, ClockIcon, GaugeIcon, CheckCircleIcon, CloseIcon } from '../components/Icons';

const spaceBreakdown = [
  { name: 'T Nagar Spot A', value: 65 },
  { name: 'T Nagar Spot B', value: 25 },
  { name: 'Anna Nagar ML', value: 10 },
];

const COLORS = ['#0B1628', '#0F766E', '#D90410'];

const payouts = [
  { date: '2024-06-25', amount: 4320, status: 'Processed', bank: 'SBI ***1234' },
  { date: '2024-05-25', amount: 3960, status: 'Processed', bank: 'SBI ***1234' },
  { date: '2024-04-25', amount: 3300, status: 'Processed', bank: 'SBI ***1234' },
];

export default function Revenue() {
  useDocumentTitle('Revenue & Payouts');
  const { revenueStats } = useRevenue();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const pendingAmount = 3960;

  const chartData = revenueStats.monthlyRevenue.map((d) => ({
    month: d.month,
    gross: d.revenue,
    payout: Math.round(d.revenue * 0.8),
    platform: Math.round(d.revenue * 0.2),
  }));

  const handleRequestPayout = async () => {
    setLoading(true);
    setBanner(null);
    try {
      await hostApi.requestPayout({ amount: pendingAmount });
      setConfirmOpen(false);
      setBanner({
        type: 'success',
        text: `Payout request for ₹${pendingAmount.toLocaleString('en-IN')} submitted to SBI ***1234.`,
      });
    } catch (err: any) {
      setConfirmOpen(false);
      setBanner({
        type: 'error',
        text: 'Error requesting payout: ' + (err.response?.data?.message || 'Service temporarily unavailable'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Revenue & Payouts' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue &amp; Payouts</h1>
          <p className="page-subtitle">
            Monthly earnings breakdown, platform commission audit, and bank settlement history.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setConfirmOpen(true)} disabled={loading}>
          {loading ? 'Processing...' : `Request Payout (₹${pendingAmount.toLocaleString('en-IN')})`}
        </button>
      </div>

      {banner && (
        <div className={`status-banner status-banner--${banner.type}`} role="status">
          <span>{banner.text}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            aria-label="Dismiss notification"
            onClick={() => setBanner(null)}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Earned (YTD)', value: '₹1,04,800', Icon: CurrencyIcon, color: 'var(--green)' },
          { label: 'Pending Payout', value: '₹3,960', Icon: ClockIcon, color: 'var(--yellow)' },
          { label: 'Platform Fee (20%)', value: '₹20,960', Icon: GaugeIcon, color: 'var(--text-primary)' },
          { label: 'Net Payout (80%)', value: '₹83,840', Icon: CheckCircleIcon, color: 'var(--blue)' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="stat-card">
            <div>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color }}>{value}</div>
            </div>
            <div className="stat-icon">
              <Icon size={18} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Monthly Settlement Breakdown</h2>
            <span className="card-meta">80 / 20 Split</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2D8" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={{ stroke: '#DFDDD4' }} tickLine={false} />
              <YAxis tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12, color: '#334155' }} />
              <Bar dataKey="payout" name="Host Payout (₹)" fill="#0F766E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="platform" name="Platform Fee (₹)" fill="#0B1628" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Revenue Share by Space</h2>
            <span className="card-meta">Chennai Portfolio</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={spaceBreakdown} cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={3} dataKey="value">
                {spaceBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12, color: '#334155' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payout History */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Bank Settlement History</h2>
          <span className="card-meta">NEFT / IMPS</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Settlement Date</th>
                <th>Amount</th>
                <th>Bank Account</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.date}>
                  <td className="mono-num">{p.date}</td>
                  <td className="mono-num" style={{ color: 'var(--green)', fontWeight: 700 }}>
                    ₹{p.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="mono-num">{p.bank}</td>
                  <td>
                    <span className="badge badge-green">{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        titleId="payout-confirm-title"
        maxWidth={440}
        title="Confirm Bank Settlement"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleRequestPayout} disabled={loading}>
              {loading ? 'Submitting...' : 'Confirm Payout'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Transfer pending balance of{' '}
          <strong className="mono-num" style={{ color: 'var(--text-primary)' }}>
            ₹{pendingAmount.toLocaleString('en-IN')}
          </strong>{' '}
          to your registered bank account (<span className="mono-num">SBI ***1234</span>)?
        </p>
      </Modal>
    </div>
  );
}
