import { useState } from 'react';
import StatusPageShell from '../components/StatusPageShell';
import { WrenchIcon, RefreshIcon } from '../components/Icons';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const CONTROLS = [
  { name: 'Public Driver Search & Bookings', status: 'Paused (503 Mode)', tone: 'badge-yellow' },
  { name: 'Admin Audit Logs & Dispute Review', status: 'Read-Only Safe', tone: 'badge-blue' },
  { name: 'Confirmed Gate Pass QR Verification', status: 'Online', tone: 'badge-green' },
];

export default function Maintenance() {
  useDocumentTitle('503 Grid Maintenance');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  return (
    <StatusPageShell
      breadcrumbLabel="Maintenance"
      code="HTTP 503 · OPERATIONAL MAINTENANCE WINDOW"
      title="Platform Maintenance Mode Active"
      description="New marketplace bookings and host onboarding writes are paused while API Gateway and Prisma schema services complete rollout verification."
      icon={<WrenchIcon size={28} />}
      tone="warning"
      actions={[
        {
          label: 'Re-check Platform Health',
          onClick: () => setCheckedAt(new Date().toLocaleTimeString('en-IN')),
          variant: 'primary',
          icon: <RefreshIcon size={15} />,
        },
        { label: 'Manage Maintenance Toggle', to: '/settings', variant: 'outline' },
        { label: 'Open System Alerts', to: '/alerts', variant: 'outline' },
      ]}
      footer={
        checkedAt
          ? `Last health poll at ${checkedAt}. Disable maintenance mode in System Settings when deployments clear.`
          : 'All admin mutating operations are logged under Compliance Audit Logs.'
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', background: 'var(--surface-light)', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
        {CONTROLS.map((item) => (
          <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
            <span className={`badge ${item.tone}`}>{item.status}</span>
          </div>
        ))}
      </div>
    </StatusPageShell>
  );
}
