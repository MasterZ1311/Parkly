import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';

export interface StatusAction {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: ReactNode;
}

interface StatusPageShellProps {
  breadcrumbLabel: string;
  code: string;
  title: string;
  description: string;
  icon: ReactNode;
  tone?: 'danger' | 'warning' | 'info' | 'neutral';
  actions: StatusAction[];
  children?: ReactNode;
  footer?: ReactNode;
}

const TONE_MAP = {
  danger: { bg: 'var(--red-soft)', border: 'var(--red-border)', fg: 'var(--red)' },
  warning: { bg: 'var(--yellow-soft)', border: 'var(--yellow-border)', fg: 'var(--yellow)' },
  info: { bg: 'var(--blue-soft)', border: 'var(--blue-border)', fg: 'var(--blue)' },
  neutral: { bg: 'var(--surface-light)', border: 'var(--border)', fg: 'var(--text-primary)' },
} as const;

export default function StatusPageShell({
  breadcrumbLabel,
  code,
  title,
  description,
  icon,
  tone = 'warning',
  actions,
  children,
  footer,
}: StatusPageShellProps) {
  const palette = TONE_MAP[tone];

  return (
    <div style={{ maxWidth: 680, margin: '36px auto' }}>
      <Breadcrumbs items={[{ label: breadcrumbLabel }]} />

      <div className="card" style={{ padding: '42px 32px', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            background: palette.bg,
            border: `1px solid ${palette.border}`,
            color: palette.fg,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          {icon}
        </div>
        <div className="card-meta" style={{ color: palette.fg, marginBottom: 8 }}>{code}</div>
        <h1 className="page-title" style={{ fontSize: 26, marginBottom: 10 }}>{title}</h1>
        <p className="page-subtitle" style={{ lineHeight: 1.6, maxWidth: 480, margin: '0 auto 24px' }}>
          {description}
        </p>

        {children}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: children ? 22 : 0 }}>
          {actions.map((act) => {
            const cls =
              act.variant === 'primary'
                ? 'btn btn-primary'
                : act.variant === 'secondary'
                  ? 'btn btn-secondary'
                  : 'btn btn-outline';
            if (act.to) {
              return (
                <Link key={act.label} to={act.to} className={cls}>
                  {act.icon}
                  {act.label}
                </Link>
              );
            }
            return (
              <button key={act.label} type="button" className={cls} onClick={act.onClick}>
                {act.icon}
                {act.label}
              </button>
            );
          })}
        </div>

        {footer && (
          <div style={{ marginTop: 26, borderTop: '1px solid var(--border)', paddingTop: 16, fontSize: 12.5, color: 'var(--text-muted)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
