import React, { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAlerts, AdminAlert } from '../hooks/useAdminData';
import { adminApi } from '../utils/apiClient';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const severityColor: Record<AdminAlert['severity'], string> = {
  critical: 'red',
  warning: 'yellow',
  info: 'blue',
};

export default function Alerts() {
  useDocumentTitle('System Alerts & Incidents');
  const { alerts, loading, error, refetch } = useAlerts();
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleResolve = async (id: string) => {
    setBusyId(id);
    setActionError('');
    try {
      await adminApi.resolveAlert(id);
      await refetch();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || 'Failed to resolve alert');
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    setBusyId(id);
    setActionError('');
    try {
      await adminApi.dismissAlert(id);
      await refetch();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || 'Failed to dismiss alert');
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = alerts.filter((a) => !a.resolved).length;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Alerts' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">System Alerts &amp; Incidents</h1>
          <p className="page-subtitle">{activeCount} active alert{activeCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {(error || actionError) && <div className="alert-error">{actionError || error}</div>}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Loading system alerts...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.map((a) => (
            <div key={a.id} className="card" style={{ opacity: a.resolved ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`badge badge-${severityColor[a.severity] || 'blue'}`}>{a.severity.toUpperCase()}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {a.title}
                      {a.resolved && <span style={{ color: 'var(--green)', fontSize: 12, marginLeft: 8 }}>✓ Resolved</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{a.detail}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                  {!a.resolved && (
                    <button className="btn btn-success" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => handleResolve(a.id)} disabled={busyId === a.id}>
                      Resolve
                    </button>
                  )}
                  <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => handleDismiss(a.id)} disabled={busyId === a.id}>
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
              🎉 No active alerts. All systems operational.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
