import React from 'react';

const bookings = [
  { id: 'B1291', driver: 'Arjun K.', space: 'T Nagar Spot A', host: 'Ravi Kumar', amount: 80, status: 'active', type: 'Instant', date: '2024-07-01' },
  { id: 'B1290', driver: 'Priya S.', space: 'Anna Nagar ML', host: 'Meena V.', amount: 180, status: 'confirmed', type: 'Scheduled', date: '2024-06-30' },
  { id: 'B1289', driver: 'Kiran R.', space: 'T Nagar Spot B', host: 'Ravi Kumar', amount: 70, status: 'completed', type: 'Instant', date: '2024-06-30' },
  { id: 'B1288', driver: 'Meera D.', space: 'T Nagar Spot A', host: 'Ravi Kumar', amount: 40, status: 'cancelled', type: 'Instant', date: '2024-06-29' },
  { id: 'B1287', driver: 'Rahul M.', space: 'Velachery EP', host: 'Suresh R.', amount: 150, status: 'refunded', type: 'Scheduled', date: '2024-06-29' },
];

const statusColors: Record<string, string> = {
  active: 'blue',
  confirmed: 'green',
  completed: 'green',
  cancelled: 'red',
  refunded: 'yellow',
};

export default function BookingsAdmin() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">All Bookings</h1>
          <p className="page-subtitle">Platform-wide booking activity</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" placeholder="Search by ID..." style={{ width: 180 }} />
          <select className="form-input" style={{ width: 140 }}>
            <option>All Statuses</option>
            <option>Active</option>
            <option>Confirmed</option>
            <option>Completed</option>
            <option>Cancelled</option>
            <option>Refunded</option>
          </select>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { icon: '🚗', label: 'Active', value: '91', color: 'var(--accent-light)', bg: '#6366F120' },
          { icon: '✅', label: 'Completed Today', value: '48', color: '#22C55E', bg: '#22C55E20' },
          { icon: '❌', label: 'Cancelled Today', value: '7', color: '#EF4444', bg: '#EF444420' },
          { icon: '💰', label: 'Revenue Today', value: '₹7,280', color: '#F59E0B', bg: '#F59E0B20' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, fontSize: 20 }}>{s.icon}</div>
            <div>
              <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>{s.value}</div>
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
                <th>Booking ID</th>
                <th>Driver</th>
                <th>Space</th>
                <th>Host</th>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id}>
                  <td style={{ color: 'var(--accent-light)', fontWeight: 600, cursor: 'pointer' }}>#{b.id}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{b.driver}</td>
                  <td>{b.space}</td>
                  <td>{b.host}</td>
                  <td>{b.date}</td>
                  <td><span className="badge badge-blue">{b.type}</span></td>
                  <td style={{ color: '#22C55E', fontWeight: 700 }}>₹{b.amount}</td>
                  <td>
                    <span className={`badge badge-${statusColors[b.status]}`}>
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 11 }}>
                      View
                    </button>
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
