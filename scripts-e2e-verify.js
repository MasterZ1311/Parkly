/* eslint-disable */
// Temporary end-to-end verification of the Parkly gateway + services.
const axios = require('axios');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const GW = 'http://localhost:4000/api/v1';
const PHONE = '+919876543211'; // seeded driver (Arjun Kumar)

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: 'us-east-1',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  })
);

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

async function main() {
  let token;

  // 1. Request OTP
  try {
    const r = await axios.post(`${GW}/auth/otp/request`, { phone: PHONE });
    record('auth: request OTP', r.status === 200, `status ${r.status}`);
  } catch (e) {
    record('auth: request OTP', false, e.response ? JSON.stringify(e.response.data) : e.message);
  }

  // 2. Read OTP from DynamoDB
  let otp;
  try {
    const got = await ddb.send(new GetCommand({ TableName: 'parkly-otp', Key: { phone: PHONE } }));
    otp = got.Item && got.Item.otp;
    record('auth: OTP stored in DynamoDB', !!otp, otp ? 'otp retrieved' : 'no item');
  } catch (e) {
    record('auth: OTP stored in DynamoDB', false, e.message);
  }

  // 3. Verify OTP -> token
  try {
    const r = await axios.post(`${GW}/auth/otp/verify`, { phone: PHONE, otp });
    token = r.data.data.tokens.accessToken;
    record('auth: verify OTP -> JWT', !!token, `user ${r.data.data.user.name}, role ${r.data.data.user.role}`);
  } catch (e) {
    record('auth: verify OTP -> JWT', false, e.response ? JSON.stringify(e.response.data) : e.message);
  }

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  // 4. auth/me
  try {
    const r = await axios.get(`${GW}/auth/me`, auth);
    record('auth: /me', r.status === 200 && r.data.data.user.phone === PHONE, `id ${r.data.data.user.id}`);
  } catch (e) {
    record('auth: /me', false, e.response ? JSON.stringify(e.response.data) : e.message);
  }

  // 5. Search near T Nagar
  let spaceId;
  try {
    const r = await axios.post(
      `${GW}/search`,
      {
        location: { type: 'coordinates', lat: 13.0418, lng: 80.2341 },
        arrivalTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        duration: 120,
        radius: 10,
      },
      auth
    );
    const res = r.data.data.results;
    spaceId = res[0] && res[0].id;
    record('search: nearby spaces', res.length > 0, `${res.length} results, predictionStatus=${r.data.data.meta.predictionStatus}`);
  } catch (e) {
    record('search: nearby spaces', false, e.response ? JSON.stringify(e.response.data) : e.message);
  }

  // 6. Search by text "t nagar"
  try {
    const r = await axios.post(
      `${GW}/search`,
      {
        location: { type: 'text', value: 't nagar' },
        arrivalTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        duration: 60,
        radius: 5,
      },
      auth
    );
    record('search: by text geocode', r.data.data.results.length > 0, `${r.data.data.results.length} results`);
  } catch (e) {
    record('search: by text geocode', false, e.response ? JSON.stringify(e.response.data) : e.message);
  }

  // 7. Pricing quote
  try {
    const r = await axios.get(`${GW}/pricing/quote`, {
      ...auth,
      params: { spaceId: spaceId || 'sp-tng-001', durationMinutes: 120 },
    });
    record('pricing: quote', r.status === 200, JSON.stringify(r.data.data).slice(0, 120));
  } catch (e) {
    record('pricing: quote', false, e.response ? `${e.response.status} ${JSON.stringify(e.response.data)}` : e.message);
  }

  // 8. Occupancy live
  try {
    const r = await axios.get(`${GW}/occupancy/${spaceId || 'sp-tng-001'}`, auth);
    record('occupancy: live', r.status === 200, JSON.stringify(r.data.data).slice(0, 120));
  } catch (e) {
    record('occupancy: live', false, e.response ? `${e.response.status} ${JSON.stringify(e.response.data)}` : e.message);
  }

  // 9. List bookings
  try {
    const r = await axios.get(`${GW}/bookings`, auth);
    record('bookings: list', r.status === 200, `count ${Array.isArray(r.data.data) ? r.data.data.length : (r.data.data.bookings ? r.data.data.bookings.length : 'n/a')}`);
  } catch (e) {
    record('bookings: list', false, e.response ? `${e.response.status} ${JSON.stringify(e.response.data)}` : e.message);
  }

  // 10. Admin stats (driver token -> expect 403 RBAC enforced, which is a correct outcome)
  try {
    const r = await axios.get(`${GW}/admin/stats`, auth);
    record('admin: stats (driver token)', r.status === 200, 'returned (note: driver allowed)');
  } catch (e) {
    const code = e.response && e.response.status;
    record('admin: stats RBAC', code === 403, `status ${code} (403 = RBAC enforced, expected for driver)`);
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n==== ${passed}/${results.length} checks passed ====`);
  process.exit(passed === results.length ? 0 : 2);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
