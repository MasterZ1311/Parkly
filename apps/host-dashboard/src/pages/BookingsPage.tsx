import { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useBookings, HostBooking } from '../hooks/useHostData';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { CarIcon, CheckCircleIcon, CalendarIcon, XCircleIcon } from '../components/Icons';

export default function BookingsPage() {
  useDocumentTitle('Reservations & Bookings');
  const [statusFilter, setStatusFilter] = useState('all');
  const { bookings, loading, error } = useBookings(statusFilter === 'all' ? undefined : statusFilter);
  const [selected, setSelected] = useState<HostBooking | null>(null);

  const activeCount = bookings.filter((b) => b.status === 'active' || b.status === 'confirmed').length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled' || b.status === 'refunded').length;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Bookings' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservations &amp; Bookings</h1>
          <p className="page-subtitle">
            Track active parking sessions, check-in timestamps, and driver registration numbers.
          </p>
        </div>
        <select
          className="form-select"
          aria-label="Filter bookings by status"
          style={{ width: 170 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {error && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Active & Confirmed', value: String(activeCount), Icon: CarIcon, color: 'var(--blue)' },
          { label: 'Completed', value: String(completedCount), Icon: CheckCircleIcon, color: 'var(--green)' },
          { label: 'Total Listed', value: String(bookings.length), Icon: CalendarIcon, color: 'var(--text-primary)' },
          { label: 'Cancelled / Refunded', value: String(cancelledCount), Icon: XCircleIcon, color: 'var(--red)' },
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

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading reservations...
            </div>
          ) : bookings.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
              No reservations recorded for your spaces yet.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Driver</th>
                  <th>Vehicle Plate</th>
                  <th>Parking Space</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="mono-num" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      #{b.id.slice(0, 8)}
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {b.driverName || 'Driver'}
                    </td>
                    <td>
                      <span className="badge badge-neutral mono-num">{b.vehiclePlate || '—'}</span>
                    </td>
                    <td>{b.spaceName || b.spaceId}</td>
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {new Date(b.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {new Date(b.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
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
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelected(b)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        titleId="host-booking-detail-title"
        maxWidth={460}
        title={selected ? `Reservation #${selected.id.slice(0, 10)}` : 'Reservation Details'}
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setSelected(null)}>
            Close
          </button>
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Driver', selected.driverName || 'Driver'],
              ['Phone', selected.driverPhone || '—'],
              ['Vehicle Plate', selected.vehiclePlate || '—'],
              ['Facility', selected.spaceName || selected.spaceId],
              ['Total Paid', `₹${selected.totalAmount}`],
              ['Status', selected.status.toUpperCase()],
              ['Window', `${new Date(selected.startTime).toLocaleString()} → ${new Date(selected.endTime).toLocaleString()}`],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 13.5,
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <strong className="mono-num" style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{v}</strong>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
