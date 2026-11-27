import StatusPageShell from '../components/StatusPageShell';
import { LockIcon } from '../components/Icons';
import { useAuthStore } from '../utils/authStore';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Unauthorized() {
  useDocumentTitle('403 Access Restricted');
  const { user, logout } = useAuthStore();

  return (
    <StatusPageShell
      breadcrumbLabel="Access Denied"
      code="HTTP 401 / 403 · PARTNER AUTH REQUIRED"
      title="Host Session Expired or Unauthorized"
      description="This partner desk requires an active JWT signed for a verified Parkly Host or Admin account. Driver-only tokens or expired sessions cannot modify bay capacity or view payout settlements."
      icon={<LockIcon size={28} />}
      tone="danger"
      actions={[
        { label: 'Sign In with Partner OTP', to: '/login', variant: 'primary' },
        { label: 'Clear Session', onClick: () => { void logout(); }, variant: 'outline' },
        { label: 'Back to Dashboard', to: '/', variant: 'outline' },
      ]}
      footer={
        <>
          Signed in identity: <span className="mono-num">{user?.phone || 'Guest / Unauthenticated'}</span> · Role:{' '}
          <span className="mono-num">{user?.role || 'none'}</span>
        </>
      }
    />
  );
}
