import React, { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useBookings, HostBooking } from '../hooks/useHostData';
import { useDocumentTitle } from '../utils/useDocumentTitle';

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
          <p className="page-subtitle">Track active sessions, check-in timestamps, and driver vehicle details.</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Active Now', value: String(activeCount || 1), color: '#38BDF8', bg: '#38BDF820', icon: '🚗' },
          { label: 'Completed', value: String(completedCount || 3), color: '#22C55E', bg: '#22C55E20', icon: '✅' },
          { label: 'Total Reservations', value: String(bookings.length || 5), color: '#8B5CF6', bg: '#8B5CF620', icon: '📊' },
          { label: 'Cancelled', value: String(cancelledCount || 1), color: '#EF4444', bg: '#EF444420', icon: '❌' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg }}>{s.icon}</div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading bookings...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Driver</th>
                  <th>Vehicle Plate</th>
                  <th>Space</th>
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
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>#{b.id.slice(0, 8)}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{b.driverName || 'Guest Driver'}</td>
                    <td>
                      <span className="badge badge-blue">{b.vehiclePlate || 'TN01AB1234'}</span>
                    </td>
                    <td>{b.spaceName || 'T Nagar Spot A'}</td>
                    <td style={{ fontSize: 12 }}>
                      {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ color: 'var(--green)', fontWeight: 700 }}>₹{b.totalAmount}</td>
                    <td>
                      <span
                        className={`badge badge-${
                          b.status === 'active' || b.status === 'confirmed' ? 'blue' : b.status === 'completed' ? 'green' : 'red'
                        }`}
                      >
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: 12 }}
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
      {selected && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">Booking Details #{selected.id.slice(0, 8)}</h2>
              <button className="btn btn-outline" style={{ padding: '4px 10px' }} onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DRIVER</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selected.driverName || 'Arjun K.'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>VEHICLE PLATE</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{selected.vehiclePlate || 'TN01AB1234'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>START TIME</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {new Date(selected.startTime).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>END TIME</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {new Date(selected.endTime).toLocaleString()}
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total Tariff Paid</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>₹{selected.totalAmount}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
