import { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAlerts, AdminAlert } from '../hooks/useAdminData';
import { adminApi } from '../utils/apiClient';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { CheckCircleIcon } from '../components/Icons';

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
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to resolve alert');
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
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to dismiss alert');
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
          <p className="page-subtitle">
            <span className="mono-num">{activeCount}</span> active alert{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {(error || actionError) && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{actionError || error}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 36 }}>
            Loading alerts...
          </div>
        ) : alerts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 36 }}>
            All alerts cleared. Operations nominal.
          </div>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className="card" style={{ opacity: a.resolved ? 0.65 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 240 }}>
                  <span className={`badge badge-${severityColor[a.severity] || 'blue'}`}>
                    {a.severity.toUpperCase()}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>{a.title}</span>
                      {a.resolved && (
                        <span className="badge badge-green">
                          <CheckCircleIcon size={12} />
                          Resolved
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{a.detail}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="mono-num" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginRight: 4 }}>
                    {new Date(a.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  {!a.resolved && (
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={() => handleResolve(a.id)}
                      disabled={busyId === a.id}
                    >
                      Resolve
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleDismiss(a.id)}
                    disabled={busyId === a.id}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
