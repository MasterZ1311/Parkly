import React, { useState } from 'react';
import { adminApi } from '../utils/apiClient';
import { useVerifications, useDisputes, PendingVerification, AdminDispute } from '../hooks/useAdminData';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Verifications() {
  useDocumentTitle('Host Verifications & Dispute Mediation');
  const { verifications, loading: verificationsLoading, error: verificationsError, refetch: refetchVerifications } = useVerifications();
  const { disputes, loading: disputesLoading, error: disputesError, refetch: refetchDisputes } = useDisputes();

  const [activeTab, setActiveTab] = useState<'verifications' | 'disputes'>('verifications');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [mediatingId, setMediatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const handleApprove = async (v: PendingVerification) => {
    setLoadingId(v.id);
    setActionError('');
    try {
      await adminApi.approveVerification(v.id);
      await refetchVerifications();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || 'Error approving space');
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (v: PendingVerification) => {
    const reason = prompt('Reason for rejection:') || 'Documentation incomplete';
    setLoadingId(v.id);
    setActionError('');
    try {
      await adminApi.rejectVerification(v.id, reason);
      await refetchVerifications();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || 'Error rejecting space');
    } finally {
      setLoadingId(null);
    }
  };

  const handleMediateDispute = async (dispute: AdminDispute) => {
    setMediatingId(dispute.id);
    setActionError('');
    try {
      await adminApi.mediateDispute(dispute.id, {
        bookingId: dispute.bookingId,
        incidentType: dispute.disputeType === 'unauthorized_use' ? 'OVERSTAY' : 'NO_SHOW',
        evidence: {
          sensorCheckoutTimestamp: new Date().toISOString(),
        },
      });
      await refetchDisputes();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || 'Dispute mediation agent failed');
    } finally {
      setMediatingId(null);
    }
  };

  const openDisputeCount = disputes.filter((d) => d.status === 'open' || d.status === 'under_review').length;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Verifications & Disputes' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Trust, Verifications &amp; Dispute Mediation</h1>
          <p className="page-subtitle">
            Review host property verifications and execute autonomous DisputeMediationAgent arbitration.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${activeTab === 'verifications' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('verifications')}
          >
            📋 Space Verifications ({verifications.length})
          </button>
          <button
            className={`btn ${activeTab === 'disputes' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('disputes')}
          >
            ⚖️ Dispute Mediation ({openDisputeCount})
          </button>
        </div>
      </div>

      {(actionError || verificationsError || disputesError) && (
        <div className="alert-error">{actionError || verificationsError || disputesError}</div>
      )}

      {activeTab === 'verifications' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {verificationsLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading verifications...</div>
          ) : verifications.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No pending space verifications.
            </div>
          ) : (
            verifications.map((v) => (
              <div key={v.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{v.name}</h3>
                      <span className="badge badge-yellow">⏳ Pending Review</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>📍 {v.address}</p>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <span>Host: <strong>{v.host?.user?.name || 'Registered Host'}</strong> ({v.host?.user?.phone || '—'})</span>
                      <span>Capacity: <strong>{v.totalCapacity} slots</strong></span>
                      <span>Base Rate: <strong>₹{v.hourlyRate}/hr</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline" onClick={() => handleReject(v)} disabled={loadingId === v.id}>
                      Reject
                    </button>
                    <button className="btn btn-primary" onClick={() => handleApprove(v)} disabled={loadingId === v.id}>
                      {loadingId === v.id ? 'Approving...' : '✅ Approve Space'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {disputesLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading disputes...</div>
          ) : disputes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No disputes recorded.
            </div>
          ) : (
            disputes.map((d) => {
              const isResolved = d.status === 'resolved' || d.status === 'closed';
              return (
                <div key={d.id} className="card" style={{ borderColor: isResolved ? 'var(--green)' : 'var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                          Dispute #{d.id.slice(0, 10)} — {d.disputeType.toUpperCase()}
                        </h3>
                        <span className={`badge badge-${isResolved ? 'green' : 'red'}`}>
                          {d.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Space: <strong style={{ color: 'var(--text-primary)' }}>{d.booking?.space?.name || 'Parking Space'}</strong> | Booking: #{d.bookingId.slice(0, 10)} | {new Date(d.createdAt).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {d.description}
                      </div>

                      {d.resolution && (
                        <div style={{ marginTop: 10, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--green)', borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                            Resolution Audit
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{d.resolution}</div>
                        </div>
                      )}
                    </div>

                    {!isResolved && (
                      <button
                        className="btn btn-primary"
                        style={{ minWidth: 160 }}
                        onClick={() => handleMediateDispute(d)}
                        disabled={mediatingId === d.id}
                      >
                        {mediatingId === d.id ? 'Arbitrating...' : '⚖️ Mediate via AI'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
