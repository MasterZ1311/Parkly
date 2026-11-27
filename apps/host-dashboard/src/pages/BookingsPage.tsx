import { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useBookings, HostBooking } from '../hooks/useHostData';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { CarIcon, CheckCircleIcon, CalendarIcon, XCircleIcon } from '../components/Icons';

export default function BookingsPage() {
  useDocumentTitle('Reservations & Bookings');
  const { bookings, loading } = useBookings();
  const [selected, setSelected] = useState<HostBooking | null>(null);

  const activeCount = bookings.filter((b) => b.status === 'active' || b.status === 'confirmed').length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;

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
      </div>

      {/* Summary Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Active Now', value: String(activeCount), Icon: CarIcon, color: 'var(--blue)' },
          { label: 'Completed', value: String(completedCount), Icon: CheckCircleIcon, color: 'var(--green)' },
          { label: 'Total Listed', value: String(bookings.length), Icon: CalendarIcon, color: 'var(--text-primary)' },
          { label: 'Cancelled', value: String(cancelledCount), Icon: XCircleIcon, color: 'var(--red)' },
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
                      {b.driverName || 'Guest Driver'}
                    </td>
                    <td>
                      <span className="badge badge-neutral mono-num">{b.vehiclePlate || 'TN01AB1234'}</span>
                    </td>
                    <td>{b.spaceName || 'T Nagar Spot A'}</td>
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

      {/* Booking Details Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        titleId="booking-detail-title"
        maxWidth={480}
        title={
          selected ? (
            <>
              Reservation <span className="mono-num">#{selected.id.slice(0, 8)}</span>
            </>
          ) : null
        }
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setSelected(null)}>
            Close
          </button>
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="stat-label">Driver</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 3 }}>
                  {selected.driverName || 'Arjun K.'}
                </div>
              </div>
              <div>
                <div className="stat-label">Vehicle Plate</div>
                <div className="mono-num" style={{ fontWeight: 700, color: 'var(--accent-cta)', marginTop: 3 }}>
                  {selected.vehiclePlate || 'TN01AB1234'}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="stat-label">Start Time</div>
                <div className="mono-num" style={{ fontSize: 12.5, color: 'var(--text-primary)', marginTop: 3 }}>
                  {new Date(selected.startTime).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="stat-label">End Time</div>
                <div className="mono-num" style={{ fontSize: 12.5, color: 'var(--text-primary)', marginTop: 3 }}>
                  {new Date(selected.endTime).toLocaleString()}
                </div>
              </div>
            </div>
            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total Tariff Paid</span>
              <span className="mono-num" style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>
                ₹{selected.totalAmount}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
