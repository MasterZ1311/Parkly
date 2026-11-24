import { useEffect } from 'react';

/**
 * Ensures the admin portal browser tab title dynamically reflects the active page
 * and NEVER falls back to default "Vite + React".
 */
export function useDocumentTitle(title: string, suffix = 'Parkly Admin Command') {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${suffix}` : suffix;
    document.title = fullTitle;
  }, [title, suffix]);
}
