import React, { useState } from 'react';

const pendingVerifications = [
  {
    id: 'sp-003',
    name: 'Anna Nagar Multi-Level Parking',
    host: 'Ravi Kumar',
    hostPhone: '+91 98765 43210',
    address: '12, 6th Avenue, Anna Nagar, Chennai 600040',
    slots: 20,
    rate: 60,
    ev: true,
    covered: true,
    submittedAt: '2024-07-01 09:30',
    docs: ['ID Proof', 'Address Proof', 'Property Document'],
  },
  {
    id: 'sp-008',
    name: 'Adyar Canal Road Parking',
    host: 'Meena Venkat',
    hostPhone: '+91 87654 32109',
    address: '45, Canal Road, Adyar, Chennai 600020',
    slots: 8,
    rate: 45,
    ev: false,
    covered: false,
    submittedAt: '2024-07-01 10:15',
    docs: ['ID Proof', 'Ownership Certificate'],
  },
  {
    id: 'sp-009',
    name: 'Velachery Metro Parking',
    host: 'Suresh Raj',
    hostPhone: '+91 76543 21098',
    address: '89, 100 Feet Road, Velachery, Chennai 600042',
    slots: 15,
    rate: 50,
    ev: true,
    covered: false,
    submittedAt: '2024-07-01 11:00',
    docs: ['ID Proof', 'Address Proof', 'NOC from CMRL'],
  },
];

export default function Verifications() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pending Verifications</h1>
          <p className="page-subtitle">{pendingVerifications.length} spaces awaiting review</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pendingVerifications.map(v => (
          <div key={v.id} className="card">
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
              onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{v.name}</span>
                  <span className="badge badge-yellow">⏳ Pending</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  👤 {v.host} · {v.hostPhone} · Submitted {v.submittedAt}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>📍 {v.address}</div>
              </div>
              <span style={{ color: 'var(--accent-light)', fontSize: 20 }}>
                {expandedId === v.id ? '▾' : '▸'}
              </span>
            </div>

            {expandedId === v.id && (
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                <div className="grid-3" style={{ marginBottom: 16 }}>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Total Slots</span><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{v.slots}</div></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Hourly Rate</span><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-light)' }}>₹{v.rate}/hr</div></div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Amenities</span>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      {v.ev && <span className="badge badge-blue">⚡ EV</span>}
                      {v.covered && <span className="badge badge-blue">🏠 Covered</span>}
                      {!v.ev && !v.covered && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>None</span>}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>SUBMITTED DOCUMENTS</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {v.docs.map(doc => (
                      <button key={doc} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12 }}>
                        📄 {doc}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-success" style={{ fontSize: 13, padding: '8px 20px' }}>
                    ✅ Approve & Activate
                  </button>
                  <button className="btn btn-danger" style={{ fontSize: 13, padding: '8px 20px', background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)' }}>
                    ❌ Reject
                  </button>
                  <button className="btn btn-outline" style={{ fontSize: 13, padding: '8px 20px' }}>
                    💬 Request Info
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
