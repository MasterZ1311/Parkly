import React, { useState } from 'react';
import { hostApi } from '../utils/apiClient';
import { useListings, HostListing } from '../hooks/useHostData';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

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

export default function Listings() {
  useDocumentTitle('My Parking Spaces');
  const { listings, loading: listingsLoading, error: listingsError, refetch } = useListings();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [aiResultModal, setAiResultModal] = useState<AiVerifyModalData | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const handleOpenCreate = () => {
    setEditingId(null);
    setActionError('');
    setFormData(emptyForm);
    setShowModal(true);
  };

  const handleOpenEdit = (listing: HostListing) => {
    setEditingId(listing.id);
    setActionError('');
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
    setActionError('');
    if (!formData.name.trim() || !formData.address.trim() || !formData.slots || !formData.hourlyRate) {
      setActionError('Please fill all required fields.');
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
      } else {
        await hostApi.createListing(payload);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(emptyForm);
      await refetch();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to save parking space');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteListing = async (listing: HostListing) => {
    if (!confirm(`Archive "${listing.name}"? Active bookings must complete before archiving.`)) return;
    setActionError('');
    try {
      await hostApi.deleteListing(listing.id);
      await refetch();
    } catch (err: any) {
      setActionError(err.response?.data?.error?.message || 'Unable to archive listing');
    }
  };

  const handleAiVerify = async (spaceId: string) => {
    setVerifyingId(spaceId);
    setActionError('');
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
      setActionError(err.response?.data?.error?.message || 'Autonomous AI verification request failed');
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
          <p className="page-subtitle">Configure pricing tiers, EV charging availability, and trigger autonomous verification.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate} disabled={saving || listingsLoading}>
          + Add New Space
        </button>
      </div>

      {(listingsError || actionError) && (
        <div className="alert-error">{actionError || listingsError}</div>
      )}

      {listingsLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading parking spaces...</div>
      ) : listings.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No parking spaces listed yet</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            Add your first parking bay to start accepting reservations.
          </p>
          <button className="btn btn-primary" onClick={handleOpenCreate}>+ Add Your First Space</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {listings.map((listing: HostListing) => {
            const occupancy = listing.occupancyPercent ?? 0;

            return (
              <div key={listing.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{listing.name}</h3>
                      <span className={`badge badge-${listing.status === 'active' ? 'green' : 'yellow'}`}>
                        {listing.status === 'active' ? '✅ Active' : listing.status === 'pending_verification' ? '⏳ Pending' : listing.status}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>📍 {listing.address}, {listing.city}</p>

                    <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>₹{listing.hourlyRate}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>per hour</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{listing.totalCapacity}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>slots</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: occupancy > 70 ? 'var(--green)' : 'var(--yellow)' }}>
                          {occupancy}%
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>occupancy</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      {listing.amenities?.evCharging && <span className="badge badge-blue">⚡ EV Charging</span>}
                      {listing.amenities?.covered && <span className="badge badge-blue">🏠 Covered</span>}
                      {listing.amenities?.securityLevel && (
                        <span className="badge badge-blue">🔒 {listing.amenities.securityLevel}</span>
                      )}
                    </div>
                  </div>

                  {/* Occupancy Ring & Actions */}
                  <div style={{ width: 155, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Live Occupancy</div>
                    <svg width="84" height="84" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="10" />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={occupancy > 70 ? '#10B981' : '#F59E0B'}
                        strokeWidth="10"
                        strokeDasharray={`${(2 * Math.PI * 40 * occupancy) / 100} ${2 * Math.PI * 40}`}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                      <text x="50" y="56" textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="800">
                        {occupancy}%
                      </text>
                    </svg>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '6px 10px', fontSize: 11, width: '100%', justifyContent: 'center' }}
                        onClick={() => handleAiVerify(listing.id)}
                        disabled={verifyingId === listing.id}
                      >
                        {verifyingId === listing.id ? '⚡ Verifying...' : '🤖 AI Verify'}
                      </button>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: 11, flex: 1, justifyContent: 'center' }}
                          onClick={() => handleOpenEdit(listing)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '6px 10px', fontSize: 11, flex: 1, justifyContent: 'center' }}
                          onClick={() => handleDeleteListing(listing)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Verification Results Modal */}
      {aiResultModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">🤖 AI Autonomous Verification Results</h2>
              <button className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setAiResultModal(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Status: {aiResultModal.status}</span>
                <span className={`badge badge-${aiResultModal.aiApproval ? 'green' : 'yellow'}`}>
                  {aiResultModal.aiApproval ? '✅ Auto-Approved' : '⏳ Pending Review'}
                </span>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-elevated)', fontSize: 13 }}>
                <div><strong>KYC:</strong> {aiResultModal.onboarding.kycStatus || 'N/A'} (Conf: {Math.round((aiResultModal.onboarding.confidenceScore || 0) * 100)}%)</div>
                <div><strong>Geohash:</strong> {aiResultModal.onboarding.geocoding?.geohash || 'N/A'}</div>
                <div><strong>Inspection:</strong> {aiResultModal.visualInspection.inspectionResult || 'N/A'}</div>
                <div><strong>Privacy Redactions:</strong> {aiResultModal.visualInspection.privacyActions?.blurredPlates ?? 0} plates blurred</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setAiResultModal(null)}>
                Close &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Parking Space' : 'Add New Parking Space'}</h2>
              <button className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Space Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Panagal Park Covered Bay"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Street Address *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.address}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                  placeholder="e.g. 23, Panagal Park Road, T Nagar"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input className="form-input" value={formData.state} onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Pincode</label>
                  <input className="form-input" maxLength={6} value={formData.pincode} onChange={(e) => setFormData((p) => ({ ...p, pincode: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Total Slots *</label>
                  <input type="number" className="form-input" value={formData.slots} onChange={(e) => setFormData((p) => ({ ...p, slots: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hourly Tariff (₹) *</label>
                  <input type="number" className="form-input" value={formData.hourlyRate} onChange={(e) => setFormData((p) => ({ ...p, hourlyRate: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={formData.evCharging} onChange={(e) => setFormData((p) => ({ ...p, evCharging: e.target.checked }))} />
                  EV Charging Available
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={formData.covered} onChange={(e) => setFormData((p) => ({ ...p, covered: e.target.checked }))} />
                  Covered Parking
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveListing} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Submit Space'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
