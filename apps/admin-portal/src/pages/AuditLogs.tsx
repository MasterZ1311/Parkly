import { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const logs = [
  { time: '2024-07-01 11:42', actor: 'admin@parkly.app', action: 'APPROVE_VERIFICATION', target: 'sp-003 (Anna Nagar ML)', ip: '10.0.1.24' },
  { time: '2024-07-01 11:20', actor: 'admin@parkly.app', action: 'SUSPEND_USER', target: 'u5 (Meera Devi)', ip: '10.0.1.24' },
  { time: '2024-07-01 10:05', actor: 'system', action: 'AUTO_DEACTIVATE_SPACE', target: 'Adyar Smart Park', ip: '—' },
  { time: '2024-07-01 09:30', actor: 'ravi@example.com', action: 'CREATE_SPACE', target: 'sp-003', ip: '49.207.x.x' },
  { time: '2024-06-30 18:11', actor: 'admin@parkly.app', action: 'REFUND_BOOKING', target: 'B1287 (₹150)', ip: '10.0.1.24' },
];

export default function AuditLogs() {
  useDocumentTitle('Security & Audit Trail');
  const [search, setSearch] = useState('');

  const filtered = logs.filter(
    (l) =>
      l.actor.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.target.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Audit Logs' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Security &amp; Audit Trail</h1>
          <p className="page-subtitle">Record of privileged administrative and system operations.</p>
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

      <div className="card">
        <div className="table-wrap">
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
              {filtered.map((l, i) => (
                <tr key={i}>
                  <td className="mono-num" style={{ fontSize: 12 }}>{l.time}</td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{l.actor}</td>
                  <td>
                    <span className="badge badge-blue mono-num">{l.action}</span>
                  </td>
                  <td>{l.target}</td>
                  <td className="mono-num" style={{ color: 'var(--text-muted)' }}>{l.ip}</td>
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
        </div>
      </div>
    </div>
  );
}
