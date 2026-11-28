import { buildQrMatrixPath } from '../components/QrPassSvg';

describe('buildQrMatrixPath — offline vector QR generator', () => {
  it('generates valid SVG path geometry for signed booking tokens', () => {
    const token = 'PARKLY.v1.00000000-0000-4000-8000-000000009001.ab12cd34ef567890';
    const spec = buildQrMatrixPath(token, 'M');

    expect(spec.size).toBeGreaterThanOrEqual(21);
    expect(spec.pathData.startsWith('M')).toBe(true);
    expect(spec.pathData).toContain('h1v1h-1z');
  });

  it('is deterministic and differentiates distinct booking payloads', () => {
    const a1 = buildQrMatrixPath('PARKLY:booking-1:TN01AB1234');
    const a2 = buildQrMatrixPath('PARKLY:booking-1:TN01AB1234');
    const b = buildQrMatrixPath('PARKLY:booking-2:TN09CD5678');

    expect(a1.pathData).toBe(a2.pathData);
    expect(a1.pathData).not.toBe(b.pathData);
  });

  it('handles blank or whitespace-only inputs safely using PARKLY:OFFLINE fallback', () => {
    const blank = buildQrMatrixPath('   ');
    const explicitFallback = buildQrMatrixPath('PARKLY:OFFLINE');

    expect(blank.size).toBe(explicitFallback.size);
    expect(blank.pathData).toBe(explicitFallback.pathData);
  });
});
