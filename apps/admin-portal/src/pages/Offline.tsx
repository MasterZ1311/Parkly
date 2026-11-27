import { useState } from 'react';
import StatusPageShell from '../components/StatusPageShell';
import { WifiOffIcon, RefreshIcon } from '../components/Icons';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Offline() {
  useDocumentTitle('Telemetry Offline');
  const [onlineState, setOnlineState] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  return (
    <StatusPageShell
      breadcrumbLabel="Offline"
      code={onlineState ? 'GATEWAY UNREACHABLE' : 'NETWORK DISCONNECTED'}
      title="Admin Console Connection Interrupted"
      description="Live metrics, KYC verification queues, and dispute mediation require an active connection to the Parkly API Gateway. Mutating operator actions are paused until restored."
      icon={<WifiOffIcon size={28} />}
      tone="warning"
      actions={[
        {
          label: 'Retry Connectivity Check',
          onClick: () => setOnlineState(typeof navigator !== 'undefined' ? navigator.onLine : true),
          variant: 'primary',
          icon: <RefreshIcon size={15} />,
        },
        { label: 'Open System Alerts', to: '/alerts', variant: 'outline' },
      ]}
      footer={
        <span>
          Network interface status:{' '}
          <strong style={{ color: onlineState ? 'var(--green)' : 'var(--red)' }}>
            {onlineState ? 'Online (verify API Gateway on port 4000)' : 'Offline'}
          </strong>
        </span>
      }
    />
  );
}
