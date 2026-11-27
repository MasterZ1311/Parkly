import { useState } from 'react';
import StatusPageShell from '../components/StatusPageShell';
import { WifiOffIcon, RefreshIcon } from '../components/Icons';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Offline() {
  useDocumentTitle('Connection Offline');
  const [onlineState, setOnlineState] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const recheckConnection = () => {
    setOnlineState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  };

  return (
    <StatusPageShell
      breadcrumbLabel="Offline"
      code={onlineState ? 'GATEWAY UNREACHABLE' : 'NETWORK DISCONNECTED'}
      title="Host Portal Connection Lost"
      description="Unable to reach Parkly API Gateway or local cellular/fiber connectivity dropped. Changes to bay pricing, payouts, or KYC uploads are paused until connectivity returns."
      icon={<WifiOffIcon size={28} />}
      tone="warning"
      actions={[
        {
          label: 'Retry Connection',
          onClick: recheckConnection,
          variant: 'primary',
          icon: <RefreshIcon size={15} />,
        },
        { label: 'View Bookings Snapshot', to: '/bookings', variant: 'outline' },
      ]}
      footer={
        <span>
          Browser network status:{' '}
          <strong style={{ color: onlineState ? 'var(--green)' : 'var(--red)' }}>
            {onlineState ? 'Online (check API Gateway at port 4000)' : 'Offline'}
          </strong>
        </span>
      }
    />
  );
}
