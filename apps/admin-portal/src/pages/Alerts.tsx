import React, { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  time: string;
  resolved: boolean;
}

const initialAlerts: Alert[] = [
  { id: 'a1', severity: 'critical', title: 'Payment dispute raised', detail: 'Booking #B1239 — ₹240 contested by driver', time: '25 min ago', resolved: false },
  { id: 'a2', severity: 'warning', title: 'Sensor offline', detail: 'Adyar Smart Park — occupancy sensor offline 4h', time: '2h ago', resolved: false },
  { id: 'a3', severity: 'warning', title: 'Booking spike detected', detail: 'Velachery area: 340% above baseline', time: '1h ago', resolved: false },
  { id: 'a4', severity: 'info', title: 'New host registration', detail: 'Vijay P. - T Nagar awaiting verification', time: '2 min ago', resolved: false },
];

const severityColor: Record<Alert['severity'], string> = {
  critical: 'red',
  warning: 'yellow',
  info: 'blue',
};

export default function Alerts() {
  useDocumentTitle('System Alerts & Incidents');
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);

  const resolve = (id: string) => {
    setAlerts(prev => prev.map(a => (a.id === id ? { ...a, resolved: true } : a)));
  };

  const dismiss = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const activeCount = alerts.filter(a => !a.resolved).length;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Alerts' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">System Alerts &amp; Incidents</h1>
          <p className="page-subtitle">{activeCount} active alert{activeCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {alerts.map(a => (
          <div key={a.id} className="card" style={{ opacity: a.resolved ? 0.55 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`badge badge-${severityColor[a.severity]}`}>{a.severity.toUpperCase()}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {a.title}
                    {a.resolved && <span style={{ color: 'var(--green)', fontSize: 12, marginLeft: 8 }}>✓ Resolved</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{a.detail}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.time}</span>
                {!a.resolved && (
                  <button className="btn btn-success" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => resolve(a.id)}>
                    Resolve
                  </button>
                )}
                <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => dismiss(a.id)}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
        {alerts.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
            🎉 No alerts. All clear.
          </div>
        )}
      </div>
    </div>
  );
}
