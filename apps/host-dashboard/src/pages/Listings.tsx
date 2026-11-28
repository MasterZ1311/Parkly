import { useState } from 'react';
import { Link } from 'react-router-dom';
import { hostApi } from '../utils/apiClient';
import { useListings, HostListing } from '../hooks/useHostData';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import {
  PlusIcon,
  MapPinIcon,
  ZapIcon,
  ShieldCheckIcon,
  ParkingIcon,
  CloseIcon,
  FileCheckIcon,
  CameraIcon,
} from '../components/Icons';

interface AiVerifyModalData {
  spaceId: string;
  status: string;
  aiApproval: boolean;
  onboarding: {
    kycStatus?: string;
    confidenceScore?: number;
    extractedIdentity?: {
      ownerName?: string;
      panNumber?: string;
      propertyTaxId?: string;
    };
    geocoding?: {
      geohash?: string;
      normalizedAddress?: string;
    };
    zoningCompliance?: boolean;
  };
  visualInspection: {
    inspectionResult?: string;
    detectedAttributes?: {
      clearanceMeters?: number;
      evChargerDetected?: boolean;
      cctvDetected?: boolean;
      surfaceType?: string;
    };
    privacyActions?: {
      blurredPlates?: number;
      blurredFaces?: number;
    };
    generatedDescription?: string;
  };
}

const emptyForm = {
  name: '',
  address: '',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600017',
  latitude: '13.0418',
  longitude: '80.2341',
  slots: '10',
  hourlyRate: '40',
  evCharging: false,
  covered: false,
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return { tone: 'green', label: 'Active' };
    case 'pending_verification':
      return { tone: 'yellow', label: 'Pending Verification' };
    case 'draft':
      return { tone: 'neutral', label: 'Draft' };
    case 'suspended':
      return { tone: 'red', label: 'Suspended' };
    default:
      return { tone: 'neutral', label: status };
  }
};

export default function Listings() {
  useDocumentTitle('My Parking Spaces');
  const { listings, loading: listingsLoading, error: listingsError, refetch } = useListings();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<HostListing | null>(null);
  const [aiResultModal, setAiResultModal] = useState<AiVerifyModalData | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormError(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const handleOpenEdit = (listing: HostListing) => {
    setEditingId(listing.id);
    setFormError(null);
    setFormData({
      name: listing.name,
      address: listing.address,
      city: listing.city || 'Chennai',
      state: listing.state || 'Tamil Nadu',
      pincode: listing.pincode || '600017',
      latitude: String(listing.latitude ?? 13.0418),
      longitude: String(listing.longitude ?? 80.2341),
      slots: String(listing.totalCapacity),
      hourlyRate: String(listing.hourlyRate),
      evCharging: Boolean(listing.amenities?.evCharging),
      covered: Boolean(listing.amenities?.covered),
    });
    setShowModal(true);
  };

  const handleSaveListing = async () => {
    setFormError(null);
    if (!formData.name.trim() || !formData.address.trim() || !formData.slots || !formData.hourlyRate) {
      setFormError('Please fill in Space Name, Street Address, Total Slots, and Hourly Tariff.');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      address: formData.address.trim(),
      latitude: parseFloat(formData.latitude) || 13.0418,
      longitude: parseFloat(formData.longitude) || 80.2341,
      totalCapacity: Math.max(1, parseInt(formData.slots, 10)),
      hourlyRate: Math.max(10, parseFloat(formData.hourlyRate)),
      city: formData.city.trim() || 'Chennai',
      state: formData.state.trim() || 'Tamil Nadu',
      pincode: formData.pincode.trim() || '600017',
      vehicleTypes: ['sedan', 'suv'],
      evCharging: formData.evCharging,
      covered: formData.covered,
    };

    setSaving(true);
    try {
      if (editingId) {
        await hostApi.updateListing(editingId, payload);
        setBanner({ type: 'success', text: 'Parking space updated successfully.' });
      } else {
        await hostApi.createListing(payload);
        setBanner({ type: 'success', text: 'Space created successfully and queued for KYC verification.' });
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(emptyForm);
      await refetch();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || err.message || 'Unable to save listing');
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    setBanner(null);
    try {
      await hostApi.deleteListing(archiveTarget.id);
      setBanner({ type: 'success', text: `Listing "${archiveTarget.name}" archived.` });
      setArchiveTarget(null);
      await refetch();
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.response?.data?.error?.message || err.message || 'Unable to archive listing',
      });
      setArchiveTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const handleAiVerify = async (spaceId: string) => {
    setVerifyingId(spaceId);
    setBanner(null);
    try {
      const response = await hostApi.aiVerify(spaceId, {
        documentUrls: ['https://s3.amazonaws.com/parkly/docs/electricity-bill.pdf'],
        photoUrls: ['https://s3.amazonaws.com/parkly/spaces/sample-space.jpg'],
      });
      const data = response.data?.data;
      if (data) {
        setAiResultModal(data);
        await refetch();
      }
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.response?.data?.error?.message || err.message || 'AI verification pipeline unavailable. Check backend status.',
      });
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'My Listings' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">My Parking Spaces</h1>
          <p className="page-subtitle">
            Manage parking assets, tariffs, and autonomous KYC and visual inspection status.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/verification-status" className="btn btn-outline">
            KYC Queue
          </Link>
          <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
            <PlusIcon size={16} />
            Add New Space
          </button>
        </div>
      </div>

      {listingsError && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{listingsError}</span>
        </div>
      )}

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

      {listingsLoading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading your parking spaces...
        </div>
      ) : listings.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <h2 className="card-title" style={{ marginBottom: 8 }}>No parking spaces listed yet</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 18 }}>
            Add your first parking bay or driveway in Chennai to begin earning.
          </p>
          <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
            <PlusIcon size={16} />
            Create Your First Listing
          </button>
        </div>
      ) : (
        <div className="grid-2">
          {listings.map((l) => {
            const occPct = l.occupancyPercent ?? 0;
            const badge = statusBadge(l.status);
            return (
              <div key={l.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {l.name}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPinIcon size={14} />
                      <span>{l.address}</span>
                    </p>
                  </div>
                  <span className={`badge badge-${badge.tone}`}>{badge.label}</span>
                </div>

                {/* Amenity Tags */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {l.amenities?.evCharging && (
                    <span className="badge badge-blue">
                      <ZapIcon size={12} />
                      EV Ready
                    </span>
                  )}
                  {l.amenities?.covered && <span className="badge badge-neutral">Covered</span>}
                  {l.amenities?.securityLevel && l.amenities.securityLevel !== 'none' && (
                    <span className="badge badge-green">
                      <ShieldCheckIcon size={12} />
                      {l.amenities.securityLevel.toUpperCase()}
                    </span>
                  )}
                  <span className="badge badge-neutral mono-num">
                    <ParkingIcon size={12} />
                    {l.totalCapacity} Slots
                  </span>
                </div>

                {/* Stats Row */}
                <div className="grid-3" style={{ gap: 10 }}>
                  <div style={{ background: 'var(--surface-light)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div className="mono-num" style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {l.totalCapacity}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Slots</div>
                  </div>
                  <div style={{ background: 'var(--surface-light)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div className="mono-num" style={{ fontSize: 17, fontWeight: 800, color: 'var(--green)' }}>
                      ₹{l.hourlyRate}/hr
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Base Tariff</div>
                  </div>
                  <div style={{ background: 'var(--surface-light)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div
                      className="mono-num"
                      style={{
                        fontSize: 17,
                        fontWeight: 800,
                        color: occPct > 70 ? 'var(--accent-cta)' : 'var(--blue)',
                      }}
                    >
                      {occPct}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Occupancy</div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => handleOpenEdit(l)}
                  >
                    Edit Tariff &amp; Slots
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => handleAiVerify(l.id)}
                    disabled={verifyingId === l.id}
                  >
                    {verifyingId === l.id ? 'Running AI...' : 'Run AI Audit'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-outline btn-sm"
                    onClick={() => setArchiveTarget(l)}
                  >
                    Archive
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Verification Result Modal */}
      <Modal
        open={Boolean(aiResultModal)}
        onClose={() => setAiResultModal(null)}
        titleId="ai-verify-title"
        maxWidth={520}
        title="AI Onboarding & Visual Audit Report"
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setAiResultModal(null)}>
            Close &amp; Continue
          </button>
        }
      >
        {aiResultModal && (
          <>
            <div style={{ padding: 12, background: 'var(--green-soft)', borderRadius: 8, border: '1px solid var(--green-border)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--green)' }}>
                {aiResultModal.aiApproval ? 'Auto-Approved & Active on Grid' : 'Queued for Manual Admin Verification'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                {aiResultModal.visualInspection.generatedDescription || 'AI vision & property OCR pipeline completed.'}
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
              <h3 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileCheckIcon size={15} />
                KYC &amp; Geocoding Check
              </h3>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div>
                  <strong>KYC Status:</strong> {aiResultModal.onboarding.kycStatus || 'N/A'} (Confidence:{' '}
                  <span className="mono-num">{Math.round((aiResultModal.onboarding.confidenceScore || 0) * 100)}%</span>)
                </div>
                <div><strong>Geohash:</strong> <span className="mono-num">{aiResultModal.onboarding.geocoding?.geohash || 'N/A'}</span></div>
                <div><strong>Normalized Address:</strong> {aiResultModal.onboarding.geocoding?.normalizedAddress || 'N/A'}</div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
              <h3 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CameraIcon size={15} />
                Computer Vision &amp; Privacy Guard
              </h3>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div><strong>Inspection:</strong> {aiResultModal.visualInspection.inspectionResult || 'N/A'}</div>
                <div>
                  <strong>Clearance:</strong>{' '}
                  <span className="mono-num">{aiResultModal.visualInspection.detectedAttributes?.clearanceMeters ?? 'N/A'}m</span>{' '}
                  · <strong>EV:</strong> {aiResultModal.visualInspection.detectedAttributes?.evChargerDetected ? 'Yes' : 'No'}
                </div>
                <div>
                  <strong>Privacy Redactions:</strong>{' '}
                  <span className="mono-num">{aiResultModal.visualInspection.privacyActions?.blurredPlates ?? 0}</span> plates blurred
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Add/Edit Listing Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        titleId="listing-modal-title"
        title={editingId ? 'Edit Parking Space' : 'Add New Parking Space'}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSaveListing} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Submit Space'}
            </button>
          </>
        }
      >
        {formError && (
          <div className="status-banner status-banner--error" style={{ marginBottom: 0 }}>
            <span>{formError}</span>
          </div>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="space-name">Space Name *</label>
          <input
            id="space-name"
            type="text"
            className="form-input"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Panagal Park Covered Bay"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="space-address">Street Address *</label>
          <input
            id="space-address"
            type="text"
            className="form-input"
            value={formData.address}
            onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
            placeholder="e.g. 23, Panagal Park Road, T Nagar"
          />
        </div>
        <div className="grid-3" style={{ gap: 12 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="space-city">City</label>
            <input id="space-city" className="form-input" value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="space-state">State</label>
            <input id="space-state" className="form-input" value={formData.state} onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="space-pincode">Pincode</label>
            <input id="space-pincode" className="form-input mono-num" maxLength={6} value={formData.pincode} onChange={(e) => setFormData((p) => ({ ...p, pincode: e.target.value }))} />
          </div>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="space-slots">Total Slots *</label>
            <input id="space-slots" type="number" className="form-input mono-num" value={formData.slots} onChange={(e) => setFormData((p) => ({ ...p, slots: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="space-rate">Hourly Tariff (₹) *</label>
            <input id="space-rate" type="number" className="form-input mono-num" value={formData.hourlyRate} onChange={(e) => setFormData((p) => ({ ...p, hourlyRate: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={formData.evCharging} onChange={(e) => setFormData((p) => ({ ...p, evCharging: e.target.checked }))} />
            EV Charging Available
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={formData.covered} onChange={(e) => setFormData((p) => ({ ...p, covered: e.target.checked }))} />
            Covered Parking
          </label>
        </div>
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        titleId="archive-listing-title"
        maxWidth={440}
        title="Archive Parking Space"
        footer={
          archiveTarget && (
            <>
              <button type="button" className="btn btn-outline" onClick={() => setArchiveTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmArchive} disabled={saving}>
                {saving ? 'Archiving...' : 'Archive Listing'}
              </button>
            </>
          )
        }
      >
        {archiveTarget && (
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Archive <strong>{archiveTarget.name}</strong>? Active or upcoming reservations must finish before a space can be archived.
          </p>
        )}
      </Modal>
    </div>
  );
}
