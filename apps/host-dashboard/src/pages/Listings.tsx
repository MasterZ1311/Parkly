import React, { useState } from 'react';
import { hostApi } from '../utils/api';

const mockListings = [
  {
    id: 'sp-001',
    name: 'T Nagar Parking Complex - Spot A',
    address: '23, Panagal Park Road, T Nagar, Chennai 600017',
    capacity: 10,
    hourlyRate: 40,
    status: 'active',
    evCharging: true,
    covered: true,
    occupancy: 72,
  },
  {
    id: 'sp-002',
    name: 'T Nagar Parking Complex - Spot B',
    address: '23, Panagal Park Road, T Nagar, Chennai 600017',
    capacity: 5,
    hourlyRate: 35,
    status: 'active',
    evCharging: false,
    covered: false,
    occupancy: 40,
  },
  {
    id: 'sp-003',
    name: 'Anna Nagar Multi-Level',
    address: '12, 6th Avenue, Anna Nagar, Chennai 600040',
    capacity: 20,
    hourlyRate: 60,
    status: 'pending_verification',
    evCharging: true,
    covered: true,
    occupancy: 0,
  },
];

export default function Listings() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddListing = async () => {
    if (!formData.name || !formData.address || !formData.slots || !formData.hourlyRate) {
      alert('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        address: formData.address,
        coordinates: {
          latitude: parseFloat(formData.latitude) || 0,
          longitude: parseFloat(formData.longitude) || 0,
        },
        totalSlots: parseInt(formData.slots),
        hourlyRate: parseInt(formData.hourlyRate),
      };

      if (editingId) {
        await hostApi.updateListing(editingId, payload);
        alert('Space updated successfully.');
      } else {
        await hostApi.createListing(payload);
        alert('Space added successfully! Pending verification.');
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', address: '', latitude: '', longitude: '', slots: '', hourlyRate: '' });
      // Reload listings (in real app, would refetch)
    } catch (err: any) {
      alert('Error saving space: ' + (err.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (listing: typeof mockListings[0]) => {
    setEditingId(listing.id);
    setFormData({
      name: listing.name,
      address: listing.address,
      latitude: '',
      longitude: '',
      slots: listing.capacity.toString(),
      hourlyRate: listing.hourlyRate.toString(),
    });
    setShowModal(true);
  };

  const handlePauseListing = async (spaceId: string) => {
    setLoading(true);
    try {
      await hostApi.updateListing(spaceId, { status: 'inactive' });
      alert('Space paused successfully');
      // Reload listings
    } catch (err: any) {
      alert('Error pausing space: ' + (err.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Listings</h1>
          <p className="page-subtitle">Manage your parking spaces</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', address: '', latitude: '', longitude: '', slots: '', hourlyRate: '' });
            setShowModal(true);
          }}
          disabled={loading}
        >
          + Add New Space
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mockListings.map(listing => (
          <div key={listing.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{listing.name}</h3>
                  <span className={`badge badge-${listing.status === 'active' ? 'green' : 'yellow'}`}>
                    {listing.status === 'pending_verification' ? '⏳ Pending' : '✅ Active'}
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>📍 {listing.address}</p>

                <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>₹{listing.hourlyRate}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>per hour</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{listing.capacity}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>slots</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: listing.occupancy > 70 ? 'var(--green)' : 'var(--yellow)' }}>
                      {listing.occupancy}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>occupancy</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {listing.evCharging && <span className="badge badge-blue">⚡ EV Charging</span>}
                  {listing.covered && <span className="badge badge-blue">🏠 Covered</span>}
                </div>
              </div>

              {/* Occupancy bar */}
              <div style={{ width: 120, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Live Occupancy</div>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke={listing.occupancy > 70 ? '#22C55E' : '#F59E0B'}
                    strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 40 * listing.occupancy / 100} ${2 * Math.PI * 40}`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                  <text x="50" y="55" textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="800">
                    {listing.occupancy}%
                  </text>
                </svg>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-outline"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() => handleEditClick(listing)}
                    disabled={loading}
                  >
                    Edit
                  </button>
                  {listing.status === 'active' && (
                    <button
                      className="btn btn-danger"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => handlePauseListing(listing.id)}
                      disabled={loading}
                    >
                      {loading ? '...' : 'Pause'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Listing Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="card" style={{ width: 500, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>
              {editingId ? 'Edit' : 'Add New'} Parking Space
            </h2>
            <div className="form-group">
              <label className="form-label">Space Name *</label>
              <input
                className="form-input"
                placeholder="e.g. My Apartment Parking"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address *</label>
              <input
                className="form-input"
                placeholder="Full address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input
                  className="form-input"
                  placeholder="13.0827"
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input
                  className="form-input"
                  placeholder="80.2707"
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Total Slots *</label>
                <input
                  className="form-input"
                  placeholder="5"
                  type="number"
                  name="slots"
                  value={formData.slots}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Hourly Rate (₹) *</label>
                <input
                  className="form-input"
                  placeholder="50"
                  type="number"
                  name="hourlyRate"
                  value={formData.hourlyRate}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                className="btn btn-outline"
                onClick={() => setShowModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddListing}
                disabled={loading}
              >
                {loading ? 'Submitting...' : editingId ? 'Update' : 'Submit for Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
