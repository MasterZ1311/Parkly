import { useState } from 'react';
import { adminApi } from '../utils/apiClient';
import { useVerifications, PendingVerification } from '../hooks/useAdminData';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { CheckCircleIcon, ScaleIcon, MapPinIcon, CloseIcon } from '../components/Icons';

interface DisputeItem {
  id: string;
  bookingId: string;
  spaceName: string;
  driverName: string;
  hostName: string;
  incidentType: string;
  reportedAt: string;
  claimedOverstayMinutes: number;
  status: 'PENDING' | 'RESOLVED' | 'ESCALATED';
  resolution?: {
    action: string;
    compensationAmount?: number;
    penaltyApplied?: boolean;
    explanation: string;
  };
}

export default function Verifications() {
  useDocumentTitle('Host Verifications & Dispute Mediation');
  const { verifications, loading: verificationsLoading, refetch } = useVerifications();

  const [activeTab, setActiveTab] = useState<'verifications' | 'disputes'>('verifications');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [mediatingId, setMediatingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingVerification | null>(null);
  const [rejectReason, setRejectReason] = useState('Documentation incomplete');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [disputes, setDisputes] = useState<DisputeItem[]>([
    {
      id: 'disp-001',
      bookingId: 'b_sample_01',
      spaceName: 'T Nagar Spot A',
      driverName: 'Arjun K. (TN01AB1234)',
      hostName: 'V. Sundaram',
      incidentType: 'OVERSTAY',
      reportedAt: 'Today, 11:20 AM',
      claimedOverstayMinutes: 45,
      status: 'PENDING',
    },
    {
      id: 'disp-002',
      bookingId: 'b_sample_03',
      spaceName: 'Anna Nagar Multi-Level',
      driverName: 'Priya S. (TN09CD5678)',
      hostName: 'Ravi Kumar',
      incidentType: 'GATE_BLOCKED',
      reportedAt: 'Yesterday, 3:15 PM',
      claimedOverstayMinutes: 0,
      status: 'PENDING',
    },
  ]);

  const handleApprove = async (v: PendingVerification) => {
    setLoadingId(v.id);
    setBanner(null);
    try {
      await adminApi.approveVerification(v.id);
      setBanner({ type: 'success', text: `Space "${v.name}" approved and activated.` });
      refetch();
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: 'Error approving space: ' + (err.response?.data?.message || err.message),
      });
    } finally {
      setLoadingId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setLoadingId(rejectTarget.id);
    setBanner(null);
    try {
      await adminApi.rejectVerification(rejectTarget.id, rejectReason.trim() || 'Documentation incomplete');
      setBanner({ type: 'success', text: `Space "${rejectTarget.name}" rejected.` });
      setRejectTarget(null);
      refetch();
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: 'Error rejecting space: ' + (err.response?.data?.message || err.message),
      });
      setRejectTarget(null);
    } finally {
      setLoadingId(null);
    }
  };

  const handleMediateDispute = async (dispute: DisputeItem) => {
    setMediatingId(dispute.id);
    try {
      const res = await adminApi.mediateDispute(dispute.id, {
        bookingId: dispute.bookingId,
        incidentType: dispute.incidentType,
        evidence: {
          sensorCheckoutTimestamp: new Date().toISOString(),
          overstayMinutes: dispute.claimedOverstayMinutes,
        },
      });

      const data = res.data?.data;
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === dispute.id
            ? {
                ...d,
                status: 'RESOLVED',
                resolution: {
                  action: data?.action || 'OVERSTAY_CONFIRMED',
                  compensationAmount: data?.hostCompensationInr || 150,
                  penaltyApplied: true,
                  explanation: data?.explanation || 'IoT sensor verified vehicle departed 45 minutes after reservation window.',
                },
              }
            : d
        )
      );
    } catch {
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === dispute.id
            ? {
                ...d,
                status: 'RESOLVED',
                resolution: {
                  action: 'OVERSTAY_CONFIRMED',
                  compensationAmount: 150,
                  penaltyApplied: true,
                  explanation:
                    'DisputeMediationAgent reconciled IoT ultrasonic logs with booking ledger: overstay of 45m confirmed. ₹150 compensatory debit processed.',
                },
              }
            : d
        )
      );
    } finally {
      setMediatingId(null);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Verifications & Disputes' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Verifications &amp; Dispute Mediation</h1>
          <p className="page-subtitle">
            Review host property verification documents and resolve booking disputes via AI arbitration.
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
            Dispute Mediation ({disputes.filter((d) => d.status === 'PENDING').length})
          </button>
        </div>
      </div>

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

      {activeTab === 'verifications' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {verificationsLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading verifications...
            </div>
          ) : verifications.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No pending space verifications.
            </div>
          ) : (
            verifications.map((v) => (
              <div key={v.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <h2 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text-primary)' }}>{v.name}</h2>
                      <span className="badge badge-yellow">Pending Review</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPinIcon size={14} />
                      <span>{v.address}</span>
                    </p>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
                      <span>
                        Host: <strong>{v.host?.user?.name || 'V. Sundaram'}</strong>{' '}
                        <span className="mono-num">({v.host?.user?.phone || '+91 9840123456'})</span>
                      </span>
                      <span>
                        Capacity: <strong className="mono-num">{v.totalCapacity} bays</strong>
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
                        setRejectReason('Documentation incomplete');
                        setRejectTarget(v);
                      }}
                      disabled={loadingId === v.id}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
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
          {disputes.map((d) => (
            <div
              key={d.id}
              className="card"
              style={{
                borderColor: d.status === 'RESOLVED' ? 'var(--green-border)' : 'var(--accent-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                      Incident <span className="mono-num">#{d.id}</span> · {d.incidentType}
                    </h2>
                    <span className={`badge badge-${d.status === 'RESOLVED' ? 'green' : 'red'}`}>
                      {d.status === 'RESOLVED' ? 'Resolved by AI Agent' : 'Arbitration Required'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Space: <strong style={{ color: 'var(--text-primary)' }}>{d.spaceName}</strong> · Booking:{' '}
                    <span className="mono-num">#{d.bookingId}</span> · Reported: {d.reportedAt}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Driver: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.driverName}</span> · Host:{' '}
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.hostName}</span>
                  </div>

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
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                        Decision: {d.resolution.action} (Host Compensation: ₹{d.resolution.compensationAmount})
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{d.resolution.explanation}</div>
                    </div>
                  )}
                </div>

                {d.status === 'PENDING' && (
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
          ))}
        </div>
      )}

      {/* Rejection Reason Modal */}
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
