import React, { useState } from 'react';
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
          <p className="page-subtitle">Immutable record of administrative and AI agent operations</p>
        </div>
        <input
          className="form-input"
          placeholder="Search logs..."
          style={{ width: 220 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Loading audit logs...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12 }}>{new Date(l.createdAt).toLocaleString()}</td>
                    <td style={{ color: 'var(--text-primary)' }}>{l.actorName}</td>
                    <td><span className="badge badge-blue">{l.action}</span></td>
                    <td>{l.target}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{l.ipAddress || '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                      No logs match your search.
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
