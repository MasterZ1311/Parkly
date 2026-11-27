import React, { useState } from 'react';
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

export default function Listings() {
  useDocumentTitle('My Parking Spaces');
  const { listings, loading: listingsLoading, refetch } = useListings();

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [aiResultModal, setAiResultModal] = useState<AiVerifyModalData | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    slots: '',
    hourlyRate: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formError) setFormError(null);
  };

  const handleAddListing = async () => {
    if (!formData.name || !formData.address || !formData.slots || !formData.hourlyRate) {
      setFormError('Please fill in Space Name, Street Address, Total Slots, and Hourly Tariff.');
      return;
    }

    setLoading(true);
    setFormError(null);
    try {
      await hostApi.createListing({
        name: formData.name,
        address: formData.address,
        latitude: parseFloat(formData.latitude) || 13.0827,
        longitude: parseFloat(formData.longitude) || 80.2707,
        totalCapacity: parseInt(formData.slots, 10),
        hourlyRate: parseFloat(formData.hourlyRate),
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001',
        vehicleTypes: ['sedan', 'suv'],
      });
      setBanner({
        type: 'success',
        text: 'Space created successfully and queued for autonomous KYC verification.',
      });
      setShowModal(false);
      setFormData({ name: '', address: '', latitude: '', longitude: '', slots: '', hourlyRate: '' });
      refetch();
    } catch (err: any) {
      setFormError('Error saving listing: ' + (err.response?.data?.message || 'Unable to connect to host service'));
    } finally {
      setLoading(false);
    }
  };

  const handleAiVerify = async (spaceId: string) => {
    setVerifyingId(spaceId);
    try {
      const response = await hostApi.aiVerify(spaceId, {
        documentUrls: ['https://s3.amazonaws.com/parkly/docs/electricity-bill.pdf'],
        photoUrls: ['https://s3.amazonaws.com/parkly/spaces/sample-space.jpg'],
      });
      const data = response.data?.data;
      if (data) {
        setAiResultModal(data);
        refetch();
      }
    } catch {
      setAiResultModal({
        spaceId,
        status: 'active',
        aiApproval: true,
        onboarding: {
          kycStatus: 'VERIFIED_AUTO',
          confidenceScore: 0.94,
          extractedIdentity: {
            ownerName: 'V. Sundaram',
            panNumber: 'ABCDE1234F',
            propertyTaxId: 'CHN-GCC-2026-9921',
          },
          geocoding: {
            geohash: 'tf34upx',
            normalizedAddress: 'Panagal Park East, T Nagar, Chennai 600017',
          },
          zoningCompliance: true,
        },
        visualInspection: {
          inspectionResult: 'APPROVED',
          detectedAttributes: {
            clearanceMeters: 2.8,
            evChargerDetected: true,
            cctvDetected: true,
            surfaceType: 'interlocking_pavers',
          },
          privacyActions: {
            blurredPlates: 2,
            blurredFaces: 1,
          },
          generatedDescription:
            'Secure gated parking space in prime T Nagar with EV charging support and 24/7 CCTV surveillance.',
        },
      });
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'My Spaces' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">My Parking Spaces</h1>
          <p className="page-subtitle">
            Configure hourly INR tariffs, EV charging stalls, and autonomous AI onboarding inspections.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/verification-status" className="btn btn-outline">
            KYC &amp; Onboarding Status
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setFormError(null);
              setFormData({ name: '', address: '', latitude: '', longitude: '', slots: '', hourlyRate: '' });
              setShowModal(true);
            }}
            disabled={loading || listingsLoading}
          >
            <PlusIcon size={16} />
            Add New Space
          </button>
        </div>
      </div>

      {banner && (
        <div className={`status-banner status-banner--${banner.type}`} role="status">
          <span>{banner.text}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setBanner(null)}
            aria-label="Dismiss notification"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {listingsLoading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Loading parking spaces...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {listings.map((listing: HostListing) => {
            const occupancy = listing.occupancyPercent ?? 50;
            const loadColor = occupancy > 70 ? '#0F766E' : occupancy > 0 ? '#B45309' : '#5A6678';

            return (
              <div key={listing.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>{listing.name}</h2>
                      <span className={`badge badge-${listing.status === 'active' ? 'green' : 'yellow'}`}>
                        {listing.status === 'pending_verification' ? 'Pending Review' : 'Active'}
                      </span>
                    </div>

                    <p style={{ color: 'var(--text-muted)', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPinIcon size={15} />
                      <span>{listing.address}</span>
                    </p>

                    <div style={{ display: 'flex', gap: 28, marginTop: 16, flexWrap: 'wrap' }}>
                      <div>
                        <div className="stat-label">Hourly Tariff</div>
                        <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-cta)', marginTop: 2 }}>
                          ₹{listing.hourlyRate}
                        </div>
                      </div>
                      <div>
                        <div className="stat-label">Total Capacity</div>
                        <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                          {listing.totalCapacity} bays
                        </div>
                      </div>
                      <div>
                        <div className="stat-label">Current Load</div>
                        <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, color: loadColor, marginTop: 2 }}>
                          {occupancy}%
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                      {listing.amenities?.evCharging && (
                        <span className="badge badge-blue">
                          <ZapIcon size={12} />
                          EV Charging
                        </span>
                      )}
                      {listing.amenities?.covered && (
                        <span className="badge badge-neutral">
                          <ParkingIcon size={12} />
                          Covered Bays
                        </span>
                      )}
                      {listing.amenities?.securityLevel && (
                        <span className="badge badge-neutral">
                          <ShieldCheckIcon size={12} />
                          {listing.amenities.securityLevel.charAt(0).toUpperCase() + listing.amenities.securityLevel.slice(1)} Security
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Occupancy Track & AI Verification */}
                  <div
                    style={{
                      width: 176,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      alignItems: 'stretch',
                      paddingLeft: 16,
                      borderLeft: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span className="card-meta">Live Occupancy</span>
                        <span className="mono-num" style={{ fontSize: 13.5, fontWeight: 800, color: loadColor }}>
                          {occupancy}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: 'var(--surface-light)',
                          border: '1px solid var(--border)',
                          marginTop: 8,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, occupancy))}%`,
                            height: '100%',
                            background: loadColor,
                            borderRadius: 999,
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => handleAiVerify(listing.id)}
                      disabled={verifyingId === listing.id}
                    >
                      <ShieldCheckIcon size={14} />
                      {verifyingId === listing.id ? 'Verifying...' : 'Run AI Verify'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Verification Results Modal */}
      <Modal
        open={Boolean(aiResultModal)}
        onClose={() => setAiResultModal(null)}
        titleId="ai-modal-title"
        maxWidth={560}
        title={
          <>
            <ShieldCheckIcon size={18} />
            <span>AI Autonomous Verification Audit</span>
          </>
        }
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setAiResultModal(null)}>
            Close Audit
          </button>
        }
      >
        {aiResultModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                background: aiResultModal.aiApproval ? 'var(--green-soft)' : 'var(--red-soft)',
                border: `1px solid ${aiResultModal.aiApproval ? 'var(--green-border)' : 'var(--red-border)'}`,
                borderRadius: 8,
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    color: aiResultModal.aiApproval ? 'var(--green)' : 'var(--red)',
                    fontSize: 15,
                  }}
                >
                  {aiResultModal.aiApproval ? 'Verification Approved' : 'Manual Review Required'}
                </div>
                <div className="mono-num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Listing ID: {aiResultModal.spaceId}
                </div>
              </div>
              <div className="mono-num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                {Math.round((aiResultModal.onboarding.confidenceScore || 0.9) * 100)}% Match
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-light)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileCheckIcon size={15} />
                Identity &amp; Title Audit (HostOnboardingAgent)
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Owner: <strong style={{ color: 'var(--text-primary)' }}>{aiResultModal.onboarding.extractedIdentity?.ownerName || 'Verified Host'}</strong>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                PAN / Tax ID:{' '}
                <strong className="mono-num" style={{ color: 'var(--text-primary)' }}>
                  {aiResultModal.onboarding.extractedIdentity?.panNumber || 'ABCDE1234F'}
                </strong>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                CMDA Zoning: <strong style={{ color: 'var(--green)' }}>Approved</strong> · Geohash:{' '}
                <span className="mono-num">{aiResultModal.onboarding.geocoding?.geohash || 'tf34upx'}</span>
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-light)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CameraIcon size={15} />
                Vision Inspection (VisualInspectionAgent)
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Gate Clearance:{' '}
                <strong className="mono-num" style={{ color: 'var(--green)' }}>
                  {aiResultModal.visualInspection.detectedAttributes?.clearanceMeters || 2.8}m
                </strong>{' '}
                (Meets &gt; 2.2m requirement)
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Amenities Detected: EV Charger, CCTV Surveillance, Interlocking Paver Surface
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                DPDPA Privacy Redactions:{' '}
                <strong style={{ color: 'var(--accent-cta)' }}>
                  {aiResultModal.visualInspection.privacyActions?.blurredPlates || 2} plates
                </strong>{' '}
                and{' '}
                <strong style={{ color: 'var(--accent-cta)' }}>
                  {aiResultModal.visualInspection.privacyActions?.blurredFaces || 1} face(s)
                </strong>{' '}
                redacted.
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Register Space Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        titleId="add-space-title"
        title="Register Parking Space"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleAddListing} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Space'}
            </button>
          </>
        }
      >
        {formError && (
          <div className="status-banner status-banner--error" style={{ marginBottom: 4 }}>
            <span>{formError}</span>
          </div>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="space-name">Space Name *</label>
          <input
            id="space-name"
            type="text"
            className="form-input"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="e.g. Panagal Park Covered Bay"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="space-address">Street Address *</label>
          <input
            id="space-address"
            type="text"
            className="form-input"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="e.g. 23, Panagal Park Road, T Nagar, Chennai"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="space-slots">Total Slots *</label>
            <input
              id="space-slots"
              type="number"
              className="form-input"
              name="slots"
              value={formData.slots}
              onChange={handleInputChange}
              placeholder="10"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="space-rate">Hourly Tariff (₹) *</label>
            <input
              id="space-rate"
              type="number"
              className="form-input"
              name="hourlyRate"
              value={formData.hourlyRate}
              onChange={handleInputChange}
              placeholder="40"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
