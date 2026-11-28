import { useState } from 'react';
import { adminApi } from '../utils/apiClient';
import {
  useVerifications,
  useDisputes,
  PendingVerification,
  PendingDriverKyc,
  PendingHostKyc,
  AdminDispute,
} from '../hooks/useAdminData';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { CheckCircleIcon, ScaleIcon, MapPinIcon } from '../components/Icons';

export default function Verifications() {
  useDocumentTitle('Host Verifications & Dispute Mediation');
  const {
    verifications,
    driverKycs,
    hostKycs,
    loading: verificationsLoading,
    error: verificationsError,
    refetch: refetchVerifications,
  } = useVerifications();
  const { disputes, loading: disputesLoading, error: disputesError, refetch: refetchDisputes } = useDisputes();

  const [activeTab, setActiveTab] = useState<'verifications' | 'drivers' | 'hosts' | 'disputes'>('verifications');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [mediatingId, setMediatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [rejectTarget, setRejectTarget] = useState<{ kind: 'space' | 'driver' | 'host'; id: string; label: string } | null>(null);
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

  const handleApproveDriver = async (k: PendingDriverKyc) => {
    setLoadingId(k.id);
    setActionError('');
    try {
      await adminApi.approveDriverKyc(k.id);
      await refetchVerifications();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.message || 'Error approving driver KYC');
    } finally {
      setLoadingId(null);
    }
  };

  const handleApproveHost = async (h: PendingHostKyc) => {
    setLoadingId(h.id);
    setActionError('');
    try {
      await adminApi.approveHostKyc(h.id);
      await refetchVerifications();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.message || 'Error approving host KYC');
    } finally {
      setLoadingId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setLoadingId(rejectTarget.id);
    setActionError('');
    try {
      const reason = rejectReason.trim() || 'Documentation incomplete';
      if (rejectTarget.kind === 'driver') {
        await adminApi.rejectDriverKyc(rejectTarget.id, reason);
      } else if (rejectTarget.kind === 'host') {
        await adminApi.rejectHostKyc(rejectTarget.id, reason);
      } else {
        await adminApi.rejectVerification(rejectTarget.id, reason);
      }
      setRejectTarget(null);
      setRejectReason('Documentation incomplete');
      await refetchVerifications();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.message || 'Error rejecting verification');
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
            Review host property KYC, plot pictures, Driver Licence/RC uploads, and DisputeMediationAgent arbitration.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'verifications' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('verifications')}
          >
            <CheckCircleIcon size={15} />
            Spaces &amp; Plots ({verifications.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'drivers' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('drivers')}
          >
            Driver KYC ({driverKycs.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'hosts' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('hosts')}
          >
            Host KYC ({hostKycs.length})
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
                        Type: <strong style={{ color: 'var(--text-primary)' }}>{v.spaceType || 'commercial'}</strong>
                      </span>
                      <span>
                        Capacity: <strong className="mono-num">{v.totalCapacity} slots</strong>
                      </span>
                      <span>
                        Base Rate: <strong className="mono-num">₹{v.hourlyRate}/hr</strong>
                      </span>
                      <span>
                        Plot Photos: <strong className="mono-num">{v.photoUrls?.length || 0} uploaded</strong>
                      </span>
                      {v.ownershipProofUrl && (
                        <span>
                          Ownership Proof: <strong style={{ color: 'var(--green)' }}>Attached</strong>
                        </span>
                      )}
                    </div>
                    {v.photoUrls && v.photoUrls.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        Submitted Plot Images: {v.photoUrls.join(', ')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-danger-outline"
                      onClick={() => {
                        setRejectTarget({ kind: 'space', id: v.id, label: v.name });
                        setRejectReason('Documentation or plot photo incomplete');
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
                      {loadingId === v.id ? 'Approving...' : 'Verify Location'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'drivers' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {verificationsLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading driver KYC queue...</div>
          ) : driverKycs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No pending Driver KYC submissions.
            </div>
          ) : (
            driverKycs.map((k) => (
              <div key={k.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{k.fullName}</h2>
                      <span className="badge badge-yellow">Driver KYC Pending</span>
                    </div>
                    <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span>Phone: <strong>{k.user?.phone || '—'}</strong></span>
                      <span>DL No: <strong className="mono-num">{k.drivingLicenseNumber}</strong></span>
                      <span>Vehicle Reg: <strong className="mono-num">{k.vehiclePlate}</strong></span>
                      <span>RC Book: <strong className="mono-num">{k.rcNumber}</strong></span>
                      <span>Govt ID: <strong>{k.govIdType.toUpperCase()} ({k.govIdNumberMasked})</strong></span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      Docs stored: DL Front ({k.drivingLicenseFrontUrl}) · RC Book ({k.rcDocumentUrl}) · ID ({k.govIdDocumentUrl})
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-danger-outline"
                      onClick={() => {
                        setRejectTarget({ kind: 'driver', id: k.id, label: `${k.fullName} (${k.vehiclePlate})` });
                        setRejectReason('DL or RC scan illegible');
                      }}
                      disabled={loadingId === k.id}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => handleApproveDriver(k)}
                      disabled={loadingId === k.id}
                    >
                      {loadingId === k.id ? 'Verifying...' : 'Approve Driver'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'hosts' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {verificationsLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading host KYC queue...</div>
          ) : hostKycs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No pending Host KYC submissions.
            </div>
          ) : (
            hostKycs.map((h) => (
              <div key={h.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {h.kycFullName || h.user?.name || 'Host'}
                      </h2>
                      <span className="badge badge-yellow">Host KYC Pending</span>
                    </div>
                    <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span>Phone: <strong>{h.kycPhone || h.user?.phone || '—'}</strong></span>
                      {h.panNumber && <span>PAN: <strong className="mono-num">{h.panNumber}</strong></span>}
                      <span>Govt ID: <strong>{(h.govIdType || 'aadhaar').toUpperCase()} ({h.govIdNumberMasked || '—'})</strong></span>
                      <span>Ownership Proof: <strong>{h.ownershipProofType || 'property_tax'}</strong></span>
                      <span>Plot Photos: <strong className="mono-num">{h.plotPhotoUrls?.length || 0}</strong></span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-danger-outline"
                      onClick={() => {
                        setRejectTarget({ kind: 'host', id: h.id, label: h.kycFullName || h.user?.name || 'Host' });
                        setRejectReason('Property ownership proof incomplete');
                      }}
                      disabled={loadingId === h.id}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => handleApproveHost(h)}
                      disabled={loadingId === h.id}
                    >
                      {loadingId === h.id ? 'Verifying...' : 'Approve Host'}
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
        title="Reject Verification"
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
              Provide a review note for rejecting <strong>{rejectTarget.label}</strong>.
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
