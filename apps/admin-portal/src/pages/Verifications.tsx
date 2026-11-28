import { useState } from 'react';
import { adminApi } from '../utils/apiClient';
import { useVerifications, useDisputes, PendingVerification, AdminDispute } from '../hooks/useAdminData';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { CheckCircleIcon, ScaleIcon, MapPinIcon } from '../components/Icons';

export default function Verifications() {
  useDocumentTitle('Host Verifications & Dispute Mediation');
  const { verifications, loading: verificationsLoading, error: verificationsError, refetch: refetchVerifications } = useVerifications();
  const { disputes, loading: disputesLoading, error: disputesError, refetch: refetchDisputes } = useDisputes();

  const [activeTab, setActiveTab] = useState<'verifications' | 'disputes'>('verifications');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [mediatingId, setMediatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [rejectTarget, setRejectTarget] = useState<PendingVerification | null>(null);
  const [rejectReason, setRejectReason] = useState('Documentation incomplete');

  const handleApprove = async (v: PendingVerification) => {
    setLoadingId(v.id);
    setActionError('');
    try {
      await adminApi.approveVerification(v.id);
      await refetchVerifications();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.message || 'Error approving space');
    } finally {
      setLoadingId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setLoadingId(rejectTarget.id);
    setActionError('');
    try {
      await adminApi.rejectVerification(rejectTarget.id, rejectReason.trim() || 'Documentation incomplete');
      setRejectTarget(null);
      setRejectReason('Documentation incomplete');
      await refetchVerifications();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.message || 'Error rejecting space');
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
      setActionError(err.response?.data?.error?.message || err.message || 'Dispute mediation agent failed');
    } finally {
      setMediatingId(null);
    }
  };

  const openDisputeCount = disputes.filter((d) => d.status === 'open' || d.status === 'under_review').length;
  const combinedError = actionError || verificationsError || disputesError;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Verifications & Disputes' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Trust, Verifications &amp; Dispute Mediation</h1>
          <p className="page-subtitle">
            Review host property KYC verifications and execute autonomous DisputeMediationAgent arbitration.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'verifications' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('verifications')}
          >
            <CheckCircleIcon size={15} />
            Space Verifications ({verifications.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'disputes' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('disputes')}
          >
            <ScaleIcon size={15} />
            Dispute Mediation ({openDisputeCount})
          </button>
        </div>
      </div>

      {combinedError && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{combinedError}</span>
        </div>
      )}

      {activeTab === 'verifications' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{v.name}</h2>
                      <span className="badge badge-yellow">Pending Review</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPinIcon size={14} />
                      <span>{v.address}</span>
                    </p>
                    <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span>
                        Host: <strong style={{ color: 'var(--text-primary)' }}>{v.host?.user?.name || 'Registered Host'}</strong>{' '}
                        ({v.host?.user?.phone || '—'})
                      </span>
                      <span>
                        Capacity: <strong className="mono-num">{v.totalCapacity} slots</strong>
                      </span>
                      <span>
                        Base Rate: <strong className="mono-num">₹{v.hourlyRate}/hr</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-danger-outline"
                      onClick={() => {
                        setRejectTarget(v);
                        setRejectReason('Documentation incomplete');
                      }}
                      disabled={loadingId === v.id}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => handleApprove(v)}
                      disabled={loadingId === v.id}
                    >
                      {loadingId === v.id ? 'Approving...' : 'Approve Space'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <div
                  key={d.id}
                  className="card"
                  style={{ borderColor: isResolved ? 'var(--green-border)' : 'var(--accent-border)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                          Dispute <span className="mono-num">#{d.id.slice(0, 10)}</span> · {d.disputeType.toUpperCase()}
                        </h2>
                        <span className={`badge badge-${isResolved ? 'green' : 'red'}`}>
                          {d.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Space: <strong style={{ color: 'var(--text-primary)' }}>{d.booking?.space?.name || 'Parking Space'}</strong> · Booking:{' '}
                        <span className="mono-num">#{d.bookingId.slice(0, 10)}</span> · {new Date(d.createdAt).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{d.description}</div>

                      {d.resolution && (
                        <div
                          style={{
                            marginTop: 12,
                            background: 'var(--green-soft)',
                            border: '1px solid var(--green-border)',
                            borderRadius: 8,
                            padding: 12,
                          }}
                        >
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                            Resolution Audit
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{d.resolution}</div>
                        </div>
                      )}
                    </div>

                    {!isResolved && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ minWidth: 168 }}
                        onClick={() => handleMediateDispute(d)}
                        disabled={mediatingId === d.id}
                      >
                        <ScaleIcon size={15} />
                        {mediatingId === d.id ? 'Arbitrating...' : 'Mediate via AI'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        titleId="reject-modal-title"
        maxWidth={440}
        title="Reject Space Verification"
        footer={
          rejectTarget && (
            <>
              <button type="button" className="btn btn-outline" onClick={() => setRejectTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmReject}
                disabled={loadingId === rejectTarget.id}
              >
                {loadingId === rejectTarget.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </>
          )
        }
      >
        {rejectTarget && (
          <>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              Provide a review note for rejecting <strong>{rejectTarget.name}</strong>.
            </p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="reject-reason">Rejection Reason</label>
              <input
                id="reject-reason"
                className="form-input"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
