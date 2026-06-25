import React from 'react';

const bookings = [
  { id: 'B0091', driver: 'Arjun Kumar', space: 'T Nagar Spot A', start: '2024-07-01 09:00', end: '2024-07-01 11:00', amount: 80, status: 'active', type: 'Instant' },
  { id: 'B0090', driver: 'Priya Sharma', space: 'T Nagar Spot A', start: '2024-06-30 14:00', end: '2024-06-30 17:00', amount: 120, status: 'completed', type: 'Scheduled' },
  { id: 'B0089', driver: 'Rahul Mehta', space: 'T Nagar Spot B', start: '2024-06-30 08:00', end: '2024-06-30 10:00', amount: 70, status: 'completed', type: 'Instant' },
  { id: 'B0088', driver: 'Meera Devi', space: 'T Nagar Spot A', start: '2024-06-29 11:00', end: '2024-06-29 12:00', amount: 40, status: 'cancelled', type: 'Instant' },
  { id: 'B0087', driver: 'Kiran Reddy', space: 'T Nagar Spot B', start: '2024-06-29 09:00', end: '2024-06-29 13:00', amount: 140, status: 'completed', type: 'Scheduled' },
];

export default function BookingsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bookings</h1>
          <p className="page-subtitle">All bookings for your spaces</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Active Now', value: '1', color: '#38BDF8', bg: '#38BDF820', icon: '🚗' },
          { label: 'Today', value: '3', color: '#22C55E', bg: '#22C55E20', icon: '📅' },
          { label: 'This Week', value: '18', color: '#8B5CF6', bg: '#8B5CF620', icon: '📊' },
          { label: 'Cancelled', value: '2', color: '#EF4444', bg: '#EF444420', icon: '❌' },
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

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Driver</th>
                <th>Space</th>
                <th>Start</th>
                <th>End</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id}>
                  <td style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>#{b.id}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{b.driver}</td>
                  <td>{b.space}</td>
                  <td>{b.start}</td>
                  <td>{b.end}</td>
                  <td><span className="badge badge-blue">{b.type}</span></td>
                  <td style={{ color: 'var(--green)', fontWeight: 700 }}>₹{b.amount}</td>
                  <td>
                    <span className={`badge badge-${b.status === 'active' ? 'blue' : b.status === 'completed' ? 'green' : 'red'}`}>
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
