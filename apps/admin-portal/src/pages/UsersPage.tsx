import { useState } from 'react';
import { adminApi } from '../utils/apiClient';
import { useUsers, AdminUser } from '../hooks/useAdminData';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { CloseIcon } from '../components/Icons';

export default function UsersPage() {
  useDocumentTitle('Platform Users & Roles');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [selectedRole, setSelectedRole] = useState('driver');

  const [suspendModalUser, setSuspendModalUser] = useState<AdminUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const { users, loading: usersLoading, refetch } = useUsers(
    roleFilter === 'All Roles' ? undefined : roleFilter.toLowerCase()
  );

  const filteredUsers = users.filter((u: AdminUser) => {
    const term = search.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(term) ||
      u.phone.toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
    );
  });

  const confirmSuspend = async () => {
    if (!suspendModalUser || !suspendReason.trim()) return;
    setLoading(true);
    setBanner(null);
    try {
      await adminApi.suspendUser(suspendModalUser.id, suspendReason.trim());
      setBanner({ type: 'success', text: `User ${suspendModalUser.name || suspendModalUser.phone} status updated.` });
      setSuspendModalUser(null);
      setSuspendReason('');
      refetch();
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: 'Error suspending user: ' + (err.response?.data?.message || err.message),
      });
      setSuspendModalUser(null);
    } finally {
      setLoading(false);
    }
  };

  const confirmRoleChange = async () => {
    if (!roleModalUser || selectedRole === roleModalUser.role) {
      setRoleModalUser(null);
      return;
    }
    setLoading(true);
    setBanner(null);
    try {
      await adminApi.updateUserRole(roleModalUser.id, selectedRole.toLowerCase());
      setBanner({
        type: 'success',
        text: `Role updated to ${selectedRole.toUpperCase()} for ${roleModalUser.name || roleModalUser.phone}.`,
      });
      setRoleModalUser(null);
      refetch();
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: 'Error updating role: ' + (err.response?.data?.message || err.message),
      });
      setRoleModalUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Users' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Users &amp; Roles</h1>
          <p className="page-subtitle">
            Manage drivers, hosts, platform administrators, and government nodal accounts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="Search by name, phone, email..."
            aria-label="Search users"
            style={{ width: 230 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            aria-label="Filter by role"
            style={{ width: 150 }}
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

      {banner && (
        <div className={`status-banner status-banner--${banner.type}`} role="status">
          <span>{banner.text}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            aria-label="Dismiss notification"
            onClick={() => setBanner(null)}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

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
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                      No users match the current search or role filter.{' '}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ marginLeft: 8 }}
                        onClick={() => {
                          setSearch('');
                          setRoleFilter('All Roles');
                        }}
                      >
                        Reset Filters
                      </button>
                    </td>
                  </tr>
                )}
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="mono-num" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      #{u.id.slice(0, 8)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {u.name || 'Unregistered Name'}
                      </div>
                      <div className="mono-num" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {u.phone}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.email || '—'}</td>
                    <td>
                      <span
                        className={`badge badge-${
                          u.role === 'admin'
                            ? 'red'
                            : u.role === 'host'
                            ? 'blue'
                            : u.role === 'government'
                            ? 'yellow'
                            : 'green'
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
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setRoleModalUser(u);
                            setSelectedRole(u.role);
                          }}
                          disabled={loading}
                        >
                          Change Role
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-outline btn-sm"
                          onClick={() => {
                            setSuspendModalUser(u);
                            setSuspendReason('');
                          }}
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

      {/* Role Modal */}
      <Modal
        open={Boolean(roleModalUser)}
        onClose={() => setRoleModalUser(null)}
        titleId="role-modal-title"
        maxWidth={420}
        title="Change User Role"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setRoleModalUser(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmRoleChange} disabled={loading}>
              {loading ? 'Updating...' : 'Update Role'}
            </button>
          </>
        }
      >
        {roleModalUser && (
          <>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              Select role for <strong>{roleModalUser.name || roleModalUser.phone}</strong>:
            </p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="select-user-role">Assigned Role</label>
              <select
                id="select-user-role"
                className="form-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="driver">Driver</option>
                <option value="host">Host</option>
                <option value="admin">Admin</option>
                <option value="government">Government</option>
              </select>
            </div>
          </>
        )}
      </Modal>

      {/* Suspend Modal */}
      <Modal
        open={Boolean(suspendModalUser)}
        onClose={() => setSuspendModalUser(null)}
        titleId="suspend-modal-title"
        maxWidth={440}
        title={suspendModalUser?.isActive ? 'Suspend Account' : 'Restore Account'}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setSuspendModalUser(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmSuspend}
              disabled={loading || !suspendReason.trim()}
            >
              {loading ? 'Applying...' : 'Confirm Action'}
            </button>
          </>
        }
      >
        {suspendModalUser && (
          <>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              Record an audit reason for updating{' '}
              <strong>{suspendModalUser.name || suspendModalUser.phone}</strong>.
            </p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="suspend-reason-input">Audit Reason *</label>
              <input
                id="suspend-reason-input"
                className="form-input"
                placeholder="e.g. Repeated no-show dispute escalation"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
