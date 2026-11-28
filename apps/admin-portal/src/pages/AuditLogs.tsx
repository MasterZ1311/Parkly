import { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAuditLogs } from '../hooks/useAdminData';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function AuditLogs() {
  useDocumentTitle('Security & Audit Trail');
  const { logs, loading, error } = useAuditLogs();
  const [search, setSearch] = useState('');

  const filtered = logs.filter(
    (l) =>
      l.actorName.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.target.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Audit Logs' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Security &amp; Audit Trail</h1>
          <p className="page-subtitle">Immutable record of privileged administrative and AI agent operations.</p>
        </div>
        <input
          className="form-input"
          placeholder="Search actor, action, target..."
          aria-label="Search audit logs"
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Loading audit logs...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Source IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {new Date(l.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{l.actorName}</td>
                    <td>
                      <span className="badge badge-blue mono-num">{l.action}</span>
                    </td>
                    <td className="mono-num">{l.target}</td>
                    <td className="mono-num" style={{ color: 'var(--text-muted)' }}>{l.ipAddress || '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 28 }}>
                      No audit entries match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
