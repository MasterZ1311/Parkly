import StatusPageShell from '../components/StatusPageShell';
import { AlertTriangleIcon, RefreshIcon } from '../components/Icons';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function ServerError() {
  useDocumentTitle('500 Server Error');

  return (
    <StatusPageShell
      breadcrumbLabel="Server Error"
      code="HTTP 500 / 502 · DOWNSTREAM SERVICE ERROR"
      title="Upstream Admin Request Failed"
      description="The Admin Service, Analytics Pipeline, or API Gateway failed to respond within SLA. Review System Alerts or retry after verifying container health."
      icon={<AlertTriangleIcon size={28} />}
      tone="danger"
      actions={[
        {
          label: 'Reload Console',
          onClick: () => window.location.reload(),
          variant: 'primary',
          icon: <RefreshIcon size={15} />,
        },
        { label: 'Inspect System Alerts', to: '/alerts', variant: 'outline' },
        { label: 'Review Audit Logs', to: '/audit-logs', variant: 'outline' },
      ]}
      footer="Automatic circuit-breaker telemetry notifies on-call engineers via CloudWatch Alarms."
    />
  );
}
