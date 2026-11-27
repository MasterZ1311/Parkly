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

  const { bookings, loading: bookingsLoading } = useBookings();
  const { revenueStats } = useRevenue();
  const { listings } = useListings();

  const activeSpaces = listings.filter((l) => l.status === 'active');
  const leadListing = activeSpaces[0] || listings[0];
  const leadCapacity = Math.min(leadListing?.totalCapacity || 10, 10);
  const leadOccupancy = leadListing?.occupancyPercent ?? 72;
  const occupiedCount = Math.round((leadCapacity * leadOccupancy) / 100);

  const statCards = [
    {
      Icon: CurrencyIcon,
      label: 'Total Earnings',
      value: revenueStats.totalEarnings,
      delta: '+12.5% vs prior cycle',
      deltaColor: 'var(--green)',
    },
    {
      Icon: CalendarIcon,
      label: 'Total Bookings',
      value: bookings.length > 0 ? String(bookings.length + 412) : '416',
      delta: '+8% demand growth',
      deltaColor: 'var(--blue)',
    },
    {
      Icon: ParkingIcon,
      label: 'Active Spaces',
      value: listings.length > 0 ? String(activeSpaces.length) : '3',
      delta: `${listings.filter((l) => l.status === 'pending_verification').length} pending AI audit`,
      deltaColor: 'var(--text-muted)',
    },
    {
      Icon: GaugeIcon,
      label: 'Avg Occupancy',
      value: revenueStats.avgOccupancy,
      delta: '+5% corridor yield',
      deltaColor: 'var(--green)',
    },
  ];

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
      <div className="split-grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header" style={{ marginBottom: 6 }}>
            <div>
              <div className="card-meta">
                Bay Capacity Horizon · {leadListing?.name || 'T Nagar Parking Complex - Spot A'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>
                <span className="mono-num">{leadCapacity}</span> Stalls ·{' '}
                <span className="mono-num">₹{leadListing?.hourlyRate || 40}/hr</span>
              </div>
            </div>
            <span className={`badge badge-${leadListing?.status === 'pending_verification' ? 'yellow' : 'green'}`}>
              {leadListing?.status === 'pending_verification' ? 'Pending Verification' : 'AI Verified'}
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
              occupied
            </span>
            <span>
              <strong style={{ color: 'var(--red)' }} className="mono-num">
                {leadCapacity >= 4 && occupiedCount < leadCapacity ? 1 : 0}
              </strong>{' '}
              EV hold
            </span>
            <span>
              <strong style={{ color: 'var(--green)' }} className="mono-num">
                {Math.max(0, leadCapacity - occupiedCount - (leadCapacity >= 4 && occupiedCount < leadCapacity ? 1 : 0))}
              </strong>{' '}
              open now
            </span>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-meta">Dynamic Tariff Band</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>
              Peak Demand Pricing Active
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              borderTop: '1px solid var(--border)',
              paddingTop: 14,
              marginTop: 14,
            }}
          >
            <div>
              <div className="stat-label">Base Rate</div>
              <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                ₹{leadListing?.hourlyRate || 40}/hr
              </div>
            </div>
            <div>
              <div className="stat-label">Surge Cap</div>
              <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-cta)', marginTop: 4 }}>
                ₹{Math.round((leadListing?.hourlyRate || 40) * 1.4)}/hr
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Monthly Revenue (₹)</h2>
            <span className="card-meta">Jan – Jun</span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={revenueStats.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2D8" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={{ stroke: '#DFDDD4' }} tickLine={false} />
              <YAxis tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="revenue" name="Gross (₹)" fill="#0B1628" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Bookings Velocity</h2>
            <span className="card-meta">Completed &amp; Live</span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={revenueStats.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2D8" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={{ stroke: '#DFDDD4' }} tickLine={false} />
              <YAxis tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="bookings"
                name="Bookings"
                stroke="#0F766E"
                strokeWidth={2.5}
                dot={{ fill: '#0F766E', r: 3.5 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recent Chennai Reservations</h2>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/bookings')}>
            View All Bookings
          </button>
        </div>
        <div className="table-wrap">
          {bookingsLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading reservations...
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Driver &amp; Plate</th>
                  <th>Parking Space</th>
                  <th>Check-In</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 5).map((b) => (
                  <tr key={b.id}>
                    <td className="mono-num" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      #{b.id.slice(0, 8)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {b.driverName || 'Guest Driver'}
                      </div>
                      {b.vehiclePlate && (
                        <div className="mono-num" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {b.vehiclePlate}
                        </div>
                      )}
                    </td>
                    <td>{b.spaceName || 'T Nagar Spot A'}</td>
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="mono-num" style={{ color: 'var(--green)', fontWeight: 700 }}>
                      ₹{b.totalAmount}
                    </td>
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
