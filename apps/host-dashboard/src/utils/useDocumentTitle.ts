import { useEffect } from 'react';

/**
 * Ensures the browser tab title dynamically reflects the active page
 * and NEVER falls back to default "Vite + React".
 */
export function useDocumentTitle(title: string, suffix = 'Parkly Host') {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${suffix}` : suffix;
    document.title = fullTitle;
  }, [title, suffix]);
}
