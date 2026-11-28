import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useBookings, useRevenue, useListings } from '../hooks/useHostData';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import {
  CurrencyIcon,
  CalendarIcon,
  ParkingIcon,
  GaugeIcon,
  PlusIcon,
} from '../components/Icons';

export default function Dashboard() {
  const navigate = useNavigate();
  useDocumentTitle('Overview & Performance');

  const { bookings, loading: bookingsLoading, error: bookingsError } = useBookings();
  const { revenueStats, error: revenueError } = useRevenue();
  const { listings, error: listingsError } = useListings();

  const activeSpaces = listings.filter((l) => l.status === 'active');
  const pendingCount = listings.filter((l) => l.status === 'pending_verification').length;
  const leadListing = activeSpaces[0] || listings[0];
  const leadCapacity = leadListing ? Math.min(leadListing.totalCapacity, 10) : 0;
  const leadOccupancy = leadListing?.occupancyPercent ?? 0;
  const occupiedCount = leadCapacity > 0 ? Math.round((leadCapacity * leadOccupancy) / 100) : 0;

  const avgOccupancy = useMemo(() => {
    if (listings.length === 0) return 0;
    const sum = listings.reduce((acc, l) => acc + (l.occupancyPercent ?? 0), 0);
    return Math.round(sum / listings.length);
  }, [listings]);

  const chartData = useMemo(
    () =>
      revenueStats.monthlyBreakdown.map((m) => ({
        month: m.month,
        revenue: m.net,
        bookings: m.bookings,
      })),
    [revenueStats.monthlyBreakdown],
  );

  const statCards = [
    {
      Icon: CurrencyIcon,
      label: 'Total Earnings',
      value: `₹${revenueStats.totalEarnings.toLocaleString('en-IN')}`,
      delta: `₹${revenueStats.availableBalance.toLocaleString('en-IN')} available`,
      deltaColor: 'var(--green)',
    },
    {
      Icon: CalendarIcon,
      label: 'Total Bookings',
      value: String(bookings.length),
      delta: `${bookings.filter((b) => b.status === 'confirmed' || b.status === 'active').length} active/confirmed`,
      deltaColor: 'var(--blue)',
    },
    {
      Icon: ParkingIcon,
      label: 'Active Spaces',
      value: String(activeSpaces.length),
      delta: `${pendingCount} pending verification`,
      deltaColor: 'var(--text-muted)',
    },
    {
      Icon: GaugeIcon,
      label: 'Avg Occupancy',
      value: `${avgOccupancy}%`,
      delta: 'Live sensor & bay ratio',
      deltaColor: 'var(--green)',
    },
  ];

  const loadError = bookingsError || revenueError || listingsError;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Host Performance Overview</h1>
          <p className="page-subtitle">
            Real-time Chennai bay occupancy, dynamic surge revenue, and live reservation stream.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/listings')}>
          <PlusIcon size={16} />
          Add New Space
        </button>
      </div>

      {loadError && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{loadError}</span>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {statCards.map(({ Icon, label, value, delta, deltaColor }) => (
          <div key={label} className="stat-card">
            <div>
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
              <div className="stat-delta" style={{ color: deltaColor }}>
                {delta}
              </div>
            </div>
            <div className="stat-icon">
              <Icon size={18} />
            </div>
          </div>
        ))}
      </div>

      {/* Bay Capacity Horizon + Tariff Summary */}
      {leadListing && (
        <div className="split-grid" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="card-header" style={{ marginBottom: 6 }}>
              <div>
                <div className="card-meta">Bay Capacity Horizon · {leadListing.name}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>
                  <span className="mono-num">{leadCapacity}</span> Preview Stalls ·{' '}
                  <span className="mono-num">₹{leadListing.hourlyRate}/hr</span>
                </div>
              </div>
              <span className={`badge badge-${leadListing.status === 'pending_verification' ? 'yellow' : 'green'}`}>
                {leadListing.status === 'pending_verification' ? 'Pending Verification' : 'Verified'}
              </span>
            </div>

            <div className="bay-track" role="img" aria-label={`Bay allocation ${occupiedCount} of ${leadCapacity} occupied`}>
              {Array.from({ length: leadCapacity }).map((_, idx) => {
                const slotNum = `A${idx + 1}`;
                const variant =
                  idx < occupiedCount
                    ? 'bay-cell--occupied'
                    : idx === occupiedCount && leadCapacity >= 4
                    ? 'bay-cell--hold'
                    : 'bay-cell--open';
                return (
                  <div key={slotNum} className={`bay-cell ${variant}`}>
                    {idx === occupiedCount && leadCapacity >= 4 ? 'EV' : slotNum}
                  </div>
                );
              })}
            </div>

            <div className="bay-legend">
              <span>
                <strong style={{ color: 'var(--text-primary)' }} className="mono-num">
                  {occupiedCount}
                </strong>{' '}
                Occupied
              </span>
              <span>
                <strong style={{ color: 'var(--green)' }} className="mono-num">
                  {Math.max(0, leadCapacity - occupiedCount)}
                </strong>{' '}
                Open
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Portfolio Settlement Snapshot</h2>
              <span className="card-meta">INR Ledger</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Gross Booking Volume', `₹${revenueStats.grossRevenue.toLocaleString('en-IN')}`],
                ['Platform Fee (10%)', `₹${revenueStats.platformFees.toLocaleString('en-IN')}`],
                ['Net Host Revenue', `₹${revenueStats.netRevenue.toLocaleString('en-IN')}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <strong className="mono-num" style={{ color: 'var(--text-primary)' }}>{v}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Monthly Net Revenue (₹)</h2>
            <span className="card-meta">Settled</span>
          </div>
          {chartData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No monthly revenue recorded yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2D8" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={{ stroke: '#DFDDD4' }} tickLine={false} />
                <YAxis tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #C9C5B9', borderRadius: 8, color: '#0B1628' }} />
                <Bar dataKey="revenue" fill="#D90410" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Bookings Trend</h2>
            <span className="card-meta">Volume</span>
          </div>
          {chartData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Bookings trend appears once drivers reserve your spaces.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2D8" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={{ stroke: '#DFDDD4' }} tickLine={false} />
                <YAxis tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #C9C5B9', borderRadius: 8, color: '#0B1628' }} />
                <Line type="monotone" dataKey="bookings" stroke="#0F766E" strokeWidth={2.5} dot={{ fill: '#0F766E' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Bookings</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/bookings')}>
            View All
          </button>
        </div>
        <div className="table-wrap">
          {bookingsLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading bookings...</div>
          ) : bookings.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No reservations recorded yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Driver / Vehicle</th>
                  <th>Space</th>
                  <th>Start Time</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 5).map((b) => (
                  <tr key={b.id}>
                    <td className="mono-num" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      #{b.id.slice(0, 8)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.driverName || 'Driver'}</div>
                      {b.vehiclePlate && (
                        <div className="mono-num" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.vehiclePlate}</div>
                      )}
                    </td>
                    <td>{b.spaceName}</td>
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {new Date(b.startTime).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="mono-num" style={{ color: 'var(--green)', fontWeight: 700 }}>₹{b.totalAmount}</td>
                    <td>
                      <span
                        className={`badge badge-${
                          b.status === 'active' || b.status === 'confirmed'
                            ? 'blue'
                            : b.status === 'completed'
                            ? 'green'
                            : 'red'
                        }`}
                      >
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
