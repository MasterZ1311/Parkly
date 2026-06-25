import React from 'react';

const users = [
  { id: 'u1', name: 'Arjun Kumar', phone: '+91 98765 43210', role: 'driver', bookings: 12, status: 'active', joined: '2024-01-15' },
  { id: 'u2', name: 'Ravi Kumar', phone: '+91 87654 32109', role: 'host', bookings: 0, status: 'active', joined: '2024-02-20' },
  { id: 'u3', name: 'Priya Sharma', phone: '+91 76543 21098', role: 'driver', bookings: 8, status: 'active', joined: '2024-03-10' },
  { id: 'u4', name: 'Suresh Raj', phone: '+91 65432 10987', role: 'host', bookings: 0, status: 'pending', joined: '2024-06-28' },
  { id: 'u5', name: 'Meera Devi', phone: '+91 54321 09876', role: 'driver', bookings: 3, status: 'suspended', joined: '2024-04-05' },
];

export default function UsersPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">12,847 total registered users</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" placeholder="Search users..." style={{ width: 220 }} />
          <select className="form-input" style={{ width: 120 }}>
            <option>All Roles</option>
            <option>Driver</option>
            <option>Host</option>
            <option>Admin</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Bookings</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{u.name}</td>
                  <td>{u.phone}</td>
                  <td>
                    <span className={`badge badge-${u.role === 'admin' ? 'red' : u.role === 'host' ? 'blue' : 'green'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td>{u.bookings}</td>
                  <td>
                    <span className={`badge badge-${u.status === 'active' ? 'green' : u.status === 'suspended' ? 'red' : 'yellow'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>{u.joined}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 11 }}>View</button>
                      {u.status === 'active' && (
                        <button style={{ padding: '4px 10px', fontSize: 11, border: '1px solid var(--red)', borderRadius: 6, background: 'transparent', color: 'var(--red)', cursor: 'pointer' }}>
                          Suspend
                        </button>
                      )}
                    </div>
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

// Add this to avoid missing export error
export const formInputStyle = {};
