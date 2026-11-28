import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { useRevenue, useListings } from '../hooks/useHostData';
import { hostApi } from '../utils/apiClient';
import { CurrencyIcon, ClockIcon, GaugeIcon, CheckCircleIcon, CloseIcon } from '../components/Icons';

const COLORS = ['#0B1628', '#D90410', '#0F766E', '#B45309'];

export default function Revenue() {
  useDocumentTitle('Revenue & Settlements');
  const { revenueStats, loading: revenueLoading, error: revenueError, refetch } = useRevenue();
  const { listings } = useListings();

  const [requesting, setRequesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const spaceBreakdown = useMemo(
    () =>
      listings.map((l) => ({
        name: l.name,
        value: Math.max(1, l.totalCapacity * l.hourlyRate),
      })),
    [listings],
  );

  const handleRequestPayout = async () => {
    setRequesting(true);
    setBanner(null);
    try {
      await hostApi.requestPayout({ amount: revenueStats.availableBalance });
      setConfirmOpen(false);
      setBanner({
        type: 'success',
        text: `Payout request for ₹${revenueStats.availableBalance.toLocaleString('en-IN')} submitted for settlement.`,
      });
      await refetch();
    } catch (err: any) {
      setConfirmOpen(false);
      setBanner({
        type: 'error',
        text: err.response?.data?.error?.message || err.message || 'Unable to process payout request.',
      });
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Revenue & Payouts' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue &amp; Payout Settlements</h1>
          <p className="page-subtitle">Host earnings breakdown, commission ledger, and bank settlements.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={requesting || revenueLoading || revenueStats.availableBalance <= 0}
          onClick={() => setConfirmOpen(true)}
        >
          <CurrencyIcon size={16} />
          {requesting
            ? 'Submitting...'
            : `Request Payout (₹${revenueStats.availableBalance.toLocaleString('en-IN')})`}
        </button>
      </div>

      {revenueError && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{revenueError}</span>
        </div>
      )}

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
          { label: 'Total Earned', value: `₹${revenueStats.totalEarnings.toLocaleString('en-IN')}`, Icon: CurrencyIcon, color: 'var(--green)' },
          { label: 'Available Balance', value: `₹${revenueStats.availableBalance.toLocaleString('en-IN')}`, Icon: ClockIcon, color: 'var(--yellow)' },
          { label: 'Platform Fee (10%)', value: `₹${revenueStats.platformFees.toLocaleString('en-IN')}`, Icon: GaugeIcon, color: 'var(--text-primary)' },
          { label: 'Net Revenue', value: `₹${revenueStats.netRevenue.toLocaleString('en-IN')}`, Icon: CheckCircleIcon, color: 'var(--blue)' },
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
        {/* Revenue Chart */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Monthly Earnings Breakdown</h2>
            <span className="card-meta">90 / 10 Split</span>
          </div>
          {revenueStats.monthlyBreakdown.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No completed earnings in period yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueStats.monthlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2D8" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={{ stroke: '#DFDDD4' }} tickLine={false} />
                <YAxis tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #C9C5B9', borderRadius: 8, color: '#0B1628' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#334155' }} />
                <Bar dataKey="net" name="Host Payout (₹)" fill="#0F766E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fees" name="Platform Fee (₹)" fill="#0B1628" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Space Capacity Value Breakdown */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Earnings Capacity by Space</h2>
            <span className="card-meta">Chennai Portfolio</span>
          </div>
          {spaceBreakdown.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Add listings to compare space performance.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={spaceBreakdown} cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={3} dataKey="value">
                  {spaceBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #C9C5B9', borderRadius: 8, color: '#0B1628' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#334155' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Payout History */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Payout History</h2>
          <span className="card-meta">NEFT / IMPS</span>
        </div>
        <div className="table-wrap">
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
                {revenueStats.recentPayouts.map((p) => (
                  <tr key={p.id}>
                    <td className="mono-num">{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="mono-num">#{p.id.slice(0, 8)}</td>
                    <td className="mono-num" style={{ color: 'var(--green)', fontWeight: 700 }}>
                      ₹{Number(p.amount).toLocaleString('en-IN')}
                    </td>
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
            <button type="button" className="btn btn-primary" onClick={handleRequestPayout} disabled={requesting}>
              {requesting ? 'Submitting...' : 'Confirm Payout'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Transfer available balance of{' '}
          <strong className="mono-num" style={{ color: 'var(--text-primary)' }}>
            ₹{revenueStats.availableBalance.toLocaleString('en-IN')}
          </strong>{' '}
          to your registered settlement bank account?
        </p>
      </Modal>
    </div>
  );
}
