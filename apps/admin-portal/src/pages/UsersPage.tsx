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
  const [selectedRole, setSelectedRole] = useState<'driver' | 'host' | 'admin'>('driver');

  const [suspendModalUser, setSuspendModalUser] = useState<AdminUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const [anonymizeModalUser, setAnonymizeModalUser] = useState<AdminUser | null>(null);

  const { users, loading: usersLoading, error: usersError, refetch } = useUsers(
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

  const confirmSuspend = async () => {
    if (!suspendModalUser) return;
    setLoading(true);
    setBanner(null);
    try {
      if (suspendModalUser.isActive) {
        await adminApi.suspendUser(suspendModalUser.id, suspendReason.trim() || 'Policy violation');
        setBanner({ type: 'success', text: `User ${suspendModalUser.name || suspendModalUser.phone} suspended.` });
      } else {
        await adminApi.unsuspendUser(suspendModalUser.id);
        setBanner({ type: 'success', text: `User ${suspendModalUser.name || suspendModalUser.phone} unsuspended.` });
      }
      setSuspendModalUser(null);
      setSuspendReason('');
      refetch();
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.response?.data?.error?.message || err.message || 'Error updating user status',
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
      await adminApi.updateUserRole(roleModalUser.id, selectedRole);
      setBanner({
        type: 'success',
        text: `Role updated to ${selectedRole.toUpperCase()} for ${roleModalUser.name || roleModalUser.phone}.`,
      });
      setRoleModalUser(null);
      refetch();
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.response?.data?.error?.message || err.message || 'Error updating role',
      });
      setRoleModalUser(null);
    } finally {
      setLoading(false);
    }
  };

  const confirmAnonymize = async () => {
    if (!anonymizeModalUser) return;
    setLoading(true);
    setBanner(null);
    try {
      await adminApi.anonymizeUser(anonymizeModalUser.id);
      setBanner({
        type: 'success',
        text: `Account anonymized under DPDPA compliance for ${anonymizeModalUser.phone}.`,
      });
      setAnonymizeModalUser(null);
      refetch();
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.response?.data?.error?.message || err.message || 'Failed to anonymize user',
      });
      setAnonymizeModalUser(null);
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
            Manage drivers, hosts, platform administrators, and DPDPA anonymization compliance.
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
          </select>
        </div>
      </div>

      {usersError && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{usersError}</span>
        </div>
      )}

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
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No users match your filter.</div>
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
                    <td className="mono-num" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      #{u.id.slice(0, 8)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.name || 'Unregistered'}</div>
                      <div className="mono-num" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.phone}</div>
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
                    <td className="mono-num" style={{ fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setRoleModalUser(u);
                            setSelectedRole((u.role as 'driver' | 'host' | 'admin') || 'driver');
                          }}
                          disabled={loading || Boolean(u.isAnonymized)}
                        >
                          Role
                        </button>
                        <button
                          type="button"
                          className={u.isActive ? 'btn btn-danger-outline btn-sm' : 'btn btn-success btn-sm'}
                          onClick={() => {
                            setSuspendModalUser(u);
                            setSuspendReason('');
                          }}
                          disabled={loading || Boolean(u.isAnonymized)}
                        >
                          {u.isActive ? 'Suspend' : 'Unsuspend'}
                        </button>
                        {!u.isAnonymized && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setAnonymizeModalUser(u)}
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
              {loading ? 'Updating...' : 'Save Role'}
            </button>
          </>
        }
      >
        {roleModalUser && (
          <>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              Select the access role for <strong>{roleModalUser.name || roleModalUser.phone}</strong>:
            </p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="role-select">Role</label>
              <select
                id="role-select"
                className="form-select"
                style={{ width: '100%' }}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'driver' | 'host' | 'admin')}
              >
                <option value="driver">Driver</option>
                <option value="host">Host</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </>
        )}
      </Modal>

      {/* Suspend / Unsuspend Modal */}
      <Modal
        open={Boolean(suspendModalUser)}
        onClose={() => setSuspendModalUser(null)}
        titleId="suspend-modal-title"
        maxWidth={420}
        title={suspendModalUser?.isActive ? 'Suspend Account' : 'Unsuspend Account'}
        footer={
          suspendModalUser && (
            <>
              <button type="button" className="btn btn-outline" onClick={() => setSuspendModalUser(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={suspendModalUser.isActive ? 'btn btn-primary' : 'btn btn-success'}
                onClick={confirmSuspend}
                disabled={loading}
              >
                {loading ? 'Processing...' : suspendModalUser.isActive ? 'Confirm Suspend' : 'Restore Access'}
              </button>
            </>
          )
        }
      >
        {suspendModalUser && (
          <>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              {suspendModalUser.isActive
                ? `Provide an audit reason for suspending ${suspendModalUser.name || suspendModalUser.phone}.`
                : `Restore platform access for ${suspendModalUser.name || suspendModalUser.phone}?`}
            </p>
            {suspendModalUser.isActive && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="suspend-reason">Suspension Reason</label>
                <input
                  id="suspend-reason"
                  className="form-input"
                  placeholder="e.g., Fraudulent bookings / Policy breach"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                />
              </div>
            )}
          </>
        )}
      </Modal>

      {/* DPDPA Anonymize Modal */}
      <Modal
        open={Boolean(anonymizeModalUser)}
        onClose={() => setAnonymizeModalUser(null)}
        titleId="anonymize-modal-title"
        maxWidth={440}
        title="DPDPA User Anonymization"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setAnonymizeModalUser(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmAnonymize} disabled={loading}>
              {loading ? 'Anonymizing...' : 'Permanently Anonymize'}
            </button>
          </>
        }
      >
        {anonymizeModalUser && (
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Irreversibly scrub personal identifiers (phone, email, license plates) for{' '}
            <strong>{anonymizeModalUser.name || anonymizeModalUser.phone}</strong> while preserving statutory booking ledger integrity?
          </p>
        )}
      </Modal>
    </div>
  );
}
