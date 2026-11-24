import React from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          listStyle: 'none',
          padding: 0,
          margin: 0,
          fontSize: 13,
          color: 'var(--text-muted)',
        }}
      >
        <li>
          <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Overview
          </Link>
        </li>
        {items.map((item, idx) => (
          <React.Fragment key={idx}>
            <li aria-hidden="true" style={{ color: 'var(--border)', userSelect: 'none' }}>/</li>
            <li>
              {item.path ? (
                <Link to={item.path} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" style={{ color: 'var(--text)', fontWeight: 600 }}>
                  {item.label}
                </span>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}
