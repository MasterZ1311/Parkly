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
  const [error, setError] = useState('');
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<'driver' | 'host' | 'admin'>('driver');

  const { users, loading: usersLoading, error: loadError, refetch } = useUsers(
    roleFilter === 'All Roles' ? undefined : roleFilter.toLowerCase(),
  );

  const filteredUsers = users.filter((u: AdminUser) => {
    const term = search.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(term) ||
      u.phone.toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
    );
  });

  const handleToggleSuspend = async (user: AdminUser) => {
    setError('');
    setLoading(true);
    try {
      if (user.isActive) {
        const reason = prompt(`Reason for suspending user ${user.name || user.phone}:`) || 'Policy violation';
        await adminApi.suspendUser(user.id, reason);
      } else {
        await adminApi.unsuspendUser(user.id);
      }
      await refetch();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Status update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRole = async () => {
    if (!roleModalUser) return;
    setError('');
    setLoading(true);
    try {
      await adminApi.updateUserRole(roleModalUser.id, selectedRole);
      setRoleModalUser(null);
      await refetch();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Role update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymize = async (user: AdminUser) => {
    if (!confirm(`DPDPA Anonymization for ${user.name || user.phone}? This irreversibly scrubs personal PII.`)) return;
    setError('');
    setLoading(true);
    try {
      await adminApi.anonymizeUser(user.id);
      await refetch();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Anonymization failed');
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
          <p className="page-subtitle">Governance over drivers, hosts, and platform administrators (with DPDPA compliance).</p>
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
          </select>
        </div>
      </div>

      {(error || loadError) && <div className="alert-error">{error || loadError}</div>}

      <div className="card">
        <div className="table-wrap">
          {usersLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No users found.</div>
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
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name || 'Unregistered'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.phone}</div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.email || '—'}</td>
                    <td>
                      <span className={`badge badge-${u.role === 'admin' ? 'red' : u.role === 'host' ? 'blue' : 'green'}`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${u.isAnonymized ? 'yellow' : u.isActive ? 'green' : 'red'}`}>
                        {u.isAnonymized ? 'Anonymized' : u.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => {
                            setRoleModalUser(u);
                            setSelectedRole((u.role as 'driver' | 'host' | 'admin') || 'driver');
                          }}
                          disabled={loading || Boolean(u.isAnonymized)}
                        >
                          Role
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => handleToggleSuspend(u)}
                          disabled={loading || Boolean(u.isAnonymized)}
                        >
                          {u.isActive ? 'Suspend' : 'Unsuspend'}
                        </button>
                        {!u.isAnonymized && (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => handleAnonymize(u)}
                            disabled={loading}
                          >
                            Anonymize
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {roleModalUser && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">Change User Role</h2>
              <button className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setRoleModalUser(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Select role for <strong>{roleModalUser.name || roleModalUser.phone}</strong>:
              </p>
              <select className="form-select" style={{ width: '100%' }} value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as any)}>
                <option value="driver">Driver</option>
                <option value="host">Host</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRoleModalUser(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveRole} disabled={loading}>
                {loading ? 'Updating...' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
