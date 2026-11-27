import StatusPageShell from '../components/StatusPageShell';
import { AlertTriangleIcon, RefreshIcon } from '../components/Icons';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function ServerError() {
  useDocumentTitle('500 Server Error');

  return (
    <StatusPageShell
      breadcrumbLabel="Server Error"
      code="HTTP 500 / 502 · UPSTREAM SERVICE FAILURE"
      title="Unable to Complete Host Request"
      description="An upstream microservice (Host Service, Payment Service, or Occupancy Ledger) returned an unexpected error. Existing confirmed bookings and financial payouts are unaffected."
      icon={<AlertTriangleIcon size={28} />}
      tone="danger"
      actions={[
        {
          label: 'Reload Portal',
          onClick: () => window.location.reload(),
          variant: 'primary',
          icon: <RefreshIcon size={15} />,
        },
        { label: 'Back to Dashboard', to: '/', variant: 'outline' },
        { label: 'View Revenue Ledger', to: '/revenue', variant: 'outline' },
      ]}
      footer={
        <>
          If this persists, share your timestamp and space ID with{' '}
          <a href="mailto:host-support@parkly.in" style={{ color: 'var(--accent-cta)', fontWeight: 700, textDecoration: 'none' }}>
            host-support@parkly.in
          </a>
        </>
      }
    />
  );
}
