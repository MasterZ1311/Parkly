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
      code="HTTP 401 / 403 · RBAC ENFORCEMENT"
      title="Operator Permissions Required"
      description="Access to platform user moderation, KYC approvals, and DPDPA anonymization endpoints is restricted to authenticated Admin or Government roles."
      icon={<LockIcon size={28} />}
      tone="danger"
      actions={[
        { label: 'Sign In as Operator', to: '/login', variant: 'primary' },
        { label: 'Sign Out Current Session', onClick: () => { void logout(); }, variant: 'outline' },
        { label: 'Back to Overview', to: '/', variant: 'outline' },
      ]}
      footer={
        <>
          Current identity: <span className="mono-num">{user?.phone || 'Unauthenticated'}</span> · Role:{' '}
          <span className="mono-num">{user?.role || 'none'}</span>
        </>
      }
    />
  );
}
