import { classifyApiError } from '../utils/apiErrors';

describe('classifyApiError — strict mobile error routing', () => {
  it('classifies network errors without response as offline and points to /status/offline', () => {
    const res = classifyApiError(new Error('Network Error'));
    expect(res.kind).toBe('offline');
    expect(res.statusRoute).toBe('/status/offline');
    expect(res.message).toBe('Network Error');
  });

  it('classifies 401 as session-expired with /status/session-expired route', () => {
    const res = classifyApiError({
      response: {
        status: 401,
        data: { error: { code: 'AUTHENTICATION_FAILED', message: 'JWT expired' } },
      },
    });
    expect(res.kind).toBe('session-expired');
    expect(res.status).toBe(401);
    expect(res.code).toBe('AUTHENTICATION_FAILED');
    expect(res.statusRoute).toBe('/status/session-expired');
  });

  it('classifies 403 as restricted with /status/restricted route', () => {
    const res = classifyApiError({
      response: {
        status: 403,
        data: { error: { code: 'AUTHORIZATION_FAILED', message: 'Suspended account' } },
      },
    });
    expect(res.kind).toBe('restricted');
    expect(res.statusRoute).toBe('/status/restricted');
    expect(res.message).toBe('Suspended account');
  });

  it('classifies 402 as payment-failed without masking gateway reason', () => {
    const res = classifyApiError({
      response: {
        status: 402,
        data: { error: { code: 'PAYMENT_ERROR', message: 'UPI collect timed out' } },
      },
    });
    expect(res.kind).toBe('payment-failed');
    expect(res.status).toBe(402);
    expect(res.message).toBe('UPI collect timed out');
    expect(res.statusRoute).toBeUndefined();
  });

  it('classifies 409 as conflict and 404 as not-found', () => {
    const conflict = classifyApiError({ response: { status: 409, data: {} } });
    expect(conflict.kind).toBe('conflict');

    const missing = classifyApiError({ response: { status: 404, data: {} } });
    expect(missing.kind).toBe('not-found');
  });

  it('classifies 503 as maintenance and 500/502 as server-error', () => {
    const maint = classifyApiError({ response: { status: 503, data: {} } });
    expect(maint.kind).toBe('maintenance');
    expect(maint.statusRoute).toBe('/status/maintenance');

    const serverErr = classifyApiError({ response: { status: 502, data: {} } });
    expect(serverErr.kind).toBe('server-error');
    expect(serverErr.statusRoute).toBe('/status/server-error');
  });

  it('classifies 400/422 as validation with fallback message when server omits one', () => {
    const res = classifyApiError({ response: { status: 400, data: {} } }, 'Fallback msg');
    expect(res.kind).toBe('validation');
    expect(res.message).toBe('Fallback msg');
  });
});
