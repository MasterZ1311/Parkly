import React, { useState } from 'react';
import { adminApi } from '../utils/apiClient';
import { useUsers, AdminUser } from '../hooks/useAdminData';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function UsersPage() {
  useDocumentTitle('Platform Users & Roles');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [loading, setLoading] = useState(false);

  const { users, loading: usersLoading, refetch } = useUsers(
    roleFilter === 'All Roles' ? undefined : roleFilter.toLowerCase()
  );

  const filteredUsers = users.filter((u: AdminUser) => {
    const term = search.toLowerCase();
    const matchesSearch =
      (u.name || '').toLowerCase().includes(term) ||
      u.phone.toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term);
    return matchesSearch;
  });

  const handleSuspend = async (user: AdminUser) => {
    const reason = prompt(`Reason for suspending user ${user.name || user.phone}:`);
    if (!reason) return;
    setLoading(true);
    try {
      await adminApi.suspendUser(user.id, reason);
      alert('User suspended successfully');
      refetch();
    } catch (err: any) {
      alert('Error suspending user: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (user: AdminUser) => {
    const newRole = prompt(`Enter new role for ${user.name || user.phone} (driver, host, admin, government):`, user.role);
    if (!newRole || newRole === user.role) return;
    setLoading(true);
    try {
      await adminApi.updateUserRole(user.id, newRole.toLowerCase());
      alert(`Role updated to ${newRole}`);
      refetch();
    } catch (err: any) {
      alert('Error updating role: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Users' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Users &amp; Role Management</h1>
          <p className="page-subtitle">Governance over drivers, hosts, admin operators, and government nodal viewers.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            placeholder="Search by name/phone..."
            style={{ width: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            style={{ width: 140 }}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option>All Roles</option>
            <option>Driver</option>
            <option>Host</option>
            <option>Admin</option>
            <option>Government</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {usersLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading users...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name &amp; Phone</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>#{u.id.slice(0, 8)}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name || 'Unregistered Name'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.phone}</div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.email || '—'}</td>
                    <td>
                      <span
                        className={`badge badge-${
                          u.role === 'admin' ? 'red' : u.role === 'host' ? 'blue' : u.role === 'government' ? 'yellow' : 'green'
                        }`}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${u.isActive ? 'green' : 'red'}`}>
                        {u.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => handleRoleChange(u)}
                          disabled={loading}
                        >
                          Change Role
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: 11, borderColor: 'var(--red)', color: 'var(--red)' }}
                          onClick={() => handleSuspend(u)}
                          disabled={loading}
                        >
                          {u.isActive ? 'Suspend' : 'Unsuspend'}
                        </button>
                      </div>
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
