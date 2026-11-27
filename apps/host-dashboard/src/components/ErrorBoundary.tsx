import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangleIcon, RefreshIcon } from './Icons';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected rendering error in Host Portal.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[HostPortal ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 560, width: '100%', padding: '36px 28px', textAlign: 'center' }} role="alert">
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 14,
              background: 'var(--red-soft)',
              border: '1px solid var(--red-border)',
              color: 'var(--red)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <AlertTriangleIcon size={28} />
          </div>
          <div className="card-meta" style={{ color: 'var(--red)', marginBottom: 8 }}>RUNTIME RECOVERY</div>
          <h1 className="page-title" style={{ fontSize: 24, marginBottom: 10 }}>
            Host Workspace Interrupted
          </h1>
          <p className="page-subtitle" style={{ lineHeight: 1.6, marginBottom: 18 }}>
            A component or chart state error prevented this view from rendering. Your listings, active bookings, and payout records remain intact.
          </p>

          <div
            className="mono-num"
            style={{
              background: 'var(--surface-light)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--red)',
              textAlign: 'left',
              wordBreak: 'break-word',
              marginBottom: 22,
            }}
          >
            {this.state.errorMessage}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={this.handleReset}>
              <RefreshIcon size={15} />
              Retry View
            </button>
            <a href="/" className="btn btn-outline">
              Return to Overview
            </a>
          </div>
        </div>
      </div>
    );
  }
}
