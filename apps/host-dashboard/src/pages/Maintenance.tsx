import { useState } from 'react';
import StatusPageShell from '../components/StatusPageShell';
import { WrenchIcon, RefreshIcon } from '../components/Icons';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const SUBSYSTEMS = [
  { name: 'QR Barrier Check-In & Exit Validation', status: 'Operational', tone: 'badge-green' },
  { name: 'Pricing & Settlement Ledger Writes', status: 'Paused (Maintenance)', tone: 'badge-yellow' },
  { name: 'Read-Only Space Schedules', status: 'Available', tone: 'badge-blue' },
];

export default function Maintenance() {
  useDocumentTitle('503 Scheduled Maintenance');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  return (
    <StatusPageShell
      breadcrumbLabel="Maintenance"
      code="HTTP 503 · SCHEDULED GRID WINDOW"
      title="Parkly Core Maintenance Active"
      description="Partner tariff edits and manual payout requests are briefly paused while pricing and database ledger services complete scheduled upgrades. Active confirmed driver QR passes remain valid at gates."
      icon={<WrenchIcon size={28} />}
      tone="warning"
      actions={[
        {
          label: 'Re-check Gateway Status',
          onClick: () => setCheckedAt(new Date().toLocaleTimeString('en-IN')),
          variant: 'primary',
          icon: <RefreshIcon size={15} />,
        },
        { label: 'Return to Overview', to: '/', variant: 'outline' },
      ]}
      footer={
        checkedAt
          ? `Last service check at ${checkedAt}. Scheduled maintenance windows typically clear within 10 minutes.`
          : 'Emergency gate override assistance: host-support@parkly.in'
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', background: 'var(--surface-light)', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
        {SUBSYSTEMS.map((item) => (
          <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
            <span className={`badge ${item.tone}`}>{item.status}</span>
          </div>
        ))}
      </div>
    </StatusPageShell>
  );
}
