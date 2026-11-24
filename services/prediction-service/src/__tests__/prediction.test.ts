process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-prediction-service-at-least-32-chars';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-prediction-service-at-least-32-chars';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index';

describe('Prediction Service Integration Tests', () => {
  const jwtSecret = process.env['JWT_ACCESS_SECRET']!;
  const testUserId = 'driver-user-001';
  const validToken = jwt.sign(
    { sub: testUserId, role: 'driver', phone: '+919876543210' },
    jwtSecret,
    { expiresIn: '1h' },
  );

  describe('GET /health', () => {
    it('returns 200 with prediction service status and agent readiness', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('service', 'prediction-service');
      expect(res.body).toHaveProperty('version', '1.0.0');
      expect(res.body.agents).toEqual({
        occupancyPredictor: 'READY',
        driverConcierge: 'READY',
      });
    });
  });

  describe('CORS and Security Headers', () => {
    it('allows CORS preflight from whitelisted origin', async () => {
      const res = await request(app)
        .options('/predict/occupancy')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      expect([200, 204]).toContain(res.status);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('attaches X-Response-Time and security headers', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-response-time']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Occupancy Prediction Endpoints', () => {
    it('rejects POST /predict/occupancy with missing spaceId', async () => {
      const res = await request(app)
        .post('/predict/occupancy')
        .send({ targetDurationMinutes: 60 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns prediction data for valid POST /predict/occupancy', async () => {
      const res = await request(app)
        .post('/predict/occupancy')
        .send({
          spaceId: 'space-chennai-t-nagar-01',
          targetArrivalTime: new Date(Date.now() + 3600000).toISOString(),
          targetDurationMinutes: 120,
          userCurrentLocation: {
            latitude: 13.0418,
            longitude: 80.2341,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.spaceId).toBe('space-chennai-t-nagar-01');
      expect(typeof res.body.data.arrivalProbability).toBe('number');
      expect(typeof res.body.data.confidenceScore).toBe('number');
    });

    it('returns prediction for GET /predict/occupancy/:spaceId', async () => {
      const res = await request(app)
        .get('/predict/occupancy/space-chennai-01')
        .query({
          duration: '60',
          lat: '13.0827',
          lng: '80.2707',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.spaceId).toBe('space-chennai-01');
      expect(res.body.data.arrivalProbability).toBeGreaterThanOrEqual(0);
      expect(res.body.data.arrivalProbability).toBeLessThanOrEqual(1);
    });

    it('returns batch predictions for GET /predict', async () => {
      const res = await request(app)
        .get('/predict')
        .query({
          spaceIds: 'space-001,space-002,space-003',
          arrivalTime: new Date().toISOString(),
          duration: '90',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.predictions).toBeDefined();
      expect(res.body.data.predictions['space-001']).toBeDefined();
      expect(res.body.data.predictions['space-002']).toBeDefined();
      expect(res.body.data.predictions['space-003']).toBeDefined();
    });

    it('rejects GET /predict when required query parameters are missing', async () => {
      const res = await request(app).get('/predict');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Driver Concierge Assistant Endpoints', () => {
    it('requires authentication for POST /predict/concierge', async () => {
      const res = await request(app)
        .post('/predict/concierge')
        .send({ query: 'Find parking near T Nagar' });

      expect(res.status).toBe(401);
    });

    it('processes natural language query with valid auth token', async () => {
      const res = await request(app)
        .post('/predict/concierge')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          query: 'Find covered parking near T Nagar under 60 per hour',
          currentLocation: {
            latitude: 13.0418,
            longitude: 80.2341,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });
});
