import { describe, it, expect, beforeEach } from 'vitest';
import {
  RealOCRProvider,
  RealVisionProvider,
  RealGeocodingProvider,
  RealNotificationProvider,
  encodeGeohash,
} from '../../../src';

describe('Real Tool Providers Unit & Contract Tests', () => {
  describe('RealOCRProvider', () => {
    let ocrProvider: RealOCRProvider;

    beforeEach(() => {
      ocrProvider = new RealOCRProvider();
    });

    it('rejects empty document URL with validation error', async () => {
      const res = await ocrProvider.parseDocument('');
      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects whitespace-only document URL with validation error', async () => {
      const res = await ocrProvider.parseDocument('   ');
      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe('VALIDATION_ERROR');
    });

    it('parses valid Indian PAN card and extracts 10-character PAN number', async () => {
      const res = await ocrProvider.parseDocument(
        'https://s3.ap-south-1.amazonaws.com/parkly-kyc/doc_pan_ABCDE1234F.jpg',
        'PAN'
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.confidenceScore).toBeGreaterThanOrEqual(0.85);
      expect(res.data.extractedFields.panNumber).toBe('ABCDE1234F');
      expect(res.data.extractedFields.ownerName).toBe('Suresh Krishnan');
      expect(res.data.rawText).toContain('INCOME TAX DEPARTMENT');
      expect(res.data.rawText).toContain('ABCDE1234F');
    });

    it('detects blurry or degraded PAN cards with confidence < 0.85', async () => {
      const res = await ocrProvider.parseDocument(
        'https://s3.ap-south-1.amazonaws.com/parkly-kyc/blurry_pan_doc.jpg',
        'PAN'
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.confidenceScore).toBeLessThan(0.85);
      expect(res.data.extractedFields.panNumber).toBeDefined();
    });

    it('parses Greater Chennai Corporation (GCC) property tax receipt', async () => {
      const res = await ocrProvider.parseDocument(
        'https://s3.ap-south-1.amazonaws.com/parkly-kyc/gcc_tax_receipt_GCC-PT-2024-88912.pdf',
        'PROPERTY_TAX'
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.confidenceScore).toBeGreaterThanOrEqual(0.85);
      expect(res.data.extractedFields.propertyTaxId).toBe('GCC-PT-2024-88912');
      expect(res.data.extractedFields.ownerName).toBe('Suresh Krishnan');
      expect(res.data.extractedFields.assessmentYear).toBe('2024-2025');
      expect(res.data.extractedFields.address).toContain('Chennai');
    });

    it('parses property sale deed document', async () => {
      const res = await ocrProvider.parseDocument(
        'https://s3.ap-south-1.amazonaws.com/parkly-kyc/title_deed_chennai.pdf',
        'DEED'
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.confidenceScore).toBeGreaterThanOrEqual(0.85);
      expect(res.data.extractedFields.ownerName).toBe('Suresh Krishnan');
      expect(res.data.extractedFields.address).toBeDefined();
    });

    it('gracefully falls back when configured external endpoint fails', async () => {
      const unreachableOcr = new RealOCRProvider({
        endpointUrl: 'http://127.0.0.1:59999/unreachable-ocr',
        timeoutMs: 100,
      });

      const res = await unreachableOcr.parseDocument(
        'https://s3.ap-south-1.amazonaws.com/parkly-kyc/doc_pan_ABCDE1234F.jpg',
        'PAN'
      );
      expect(res.success).toBe(true);
      if (!res.success) return;
      expect(res.data.extractedFields.panNumber).toBe('ABCDE1234F');
    });
  });

  describe('RealVisionProvider', () => {
    let visionProvider: RealVisionProvider;

    beforeEach(() => {
      visionProvider = new RealVisionProvider();
    });

    it('rejects empty spaceId with validation error', async () => {
      const res = await visionProvider.inspectSpace('', ['https://s3.parkly.in/p1.jpg']);
      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects empty photoUrls array with validation error', async () => {
      const res = await visionProvider.inspectSpace('spc_001', []);
      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe('VALIDATION_ERROR');
    });

    it('approves compliant parking space with clearance >= 2.2m', async () => {
      const res = await visionProvider.inspectSpace('spc_burkit_01', [
        'https://s3.parkly.in/space/bay_gate_clearance_2.8.jpg',
        'https://s3.parkly.in/space/bay_cctv_view.jpg',
      ]);
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.inspectionResult).toBe('APPROVED');
      expect(res.data.detectedAttributes.gateClearanceAdequate).toBe(true);
      expect(res.data.detectedAttributes.estimatedWidthMeters).toBeGreaterThanOrEqual(2.2);
      expect(res.data.detectedAttributes.cctvVisible).toBe(true);
      expect(res.data.detectedAttributes.isCovered).toBe(true);
      expect(res.data.privacyActions.licensePlatesBlurred).toBeGreaterThanOrEqual(1);
      expect(res.data.obstructions).toHaveLength(0);
    });

    it('returns ACTION_REQUIRED when gate clearance is below 2.2m standard', async () => {
      const res = await visionProvider.inspectSpace('spc_narrow_02', [
        'https://s3.parkly.in/space/narrow_gate_clearance_1.95.jpg',
      ]);
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.inspectionResult).toBe('ACTION_REQUIRED');
      expect(res.data.detectedAttributes.gateClearanceAdequate).toBe(false);
      expect(res.data.feedbackMessages.some((m) => m.includes('Gate clearance'))).toBe(true);
    });

    it('returns REJECTED when gate clearance is severely substandard (< 1.7m)', async () => {
      const res = await visionProvider.inspectSpace('spc_substandard_03', [
        'https://s3.parkly.in/space/clearance_1.5_unusable.jpg',
      ]);
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.inspectionResult).toBe('REJECTED');
      expect(res.data.detectedAttributes.gateClearanceAdequate).toBe(false);
    });

    it('detects physical obstructions and reports them in feedback', async () => {
      const res = await visionProvider.inspectSpace('spc_blocked_04', [
        'https://s3.parkly.in/space/barricade_construction.jpg',
        'https://s3.parkly.in/space/scooter_parked_entrance.jpg',
      ]);
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.inspectionResult).toBe('ACTION_REQUIRED');
      expect(res.data.obstructions.length).toBeGreaterThanOrEqual(2);
      expect(res.data.feedbackMessages.some((m) => m.includes('Obstruction'))).toBe(true);
    });

    it('detects surface types (paver, gravel, asphalt, concrete)', async () => {
      const gravelRes = await visionProvider.inspectSpace('spc_gravel', [
        'https://s3.parkly.in/space/gravel_ground.jpg',
      ]);
      expect(gravelRes.success).toBe(true);
      if (gravelRes.success) {
        expect(gravelRes.data.detectedAttributes.surfaceType).toBe('gravel');
      }

      const paverRes = await visionProvider.inspectSpace('spc_paver', [
        'https://s3.parkly.in/space/paver_blocks_floor.jpg',
      ]);
      expect(paverRes.success).toBe(true);
      if (paverRes.success) {
        expect(paverRes.data.detectedAttributes.surfaceType).toBe('paver_blocks');
      }
    });

    it('detects EV charger and applies face blurring when pedestrians are present', async () => {
      const res = await visionProvider.inspectSpace('spc_ev_05', [
        'https://s3.parkly.in/space/ev_charging_unit.jpg',
        'https://s3.parkly.in/space/person_pedestrian_walkway.jpg',
      ]);
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.detectedAttributes.evChargerDetected).toBe(true);
      expect(res.data.privacyActions.facesBlurred).toBeGreaterThanOrEqual(1);
    });
  });

  describe('RealGeocodingProvider', () => {
    let geocodingProvider: RealGeocodingProvider;

    beforeEach(() => {
      geocodingProvider = new RealGeocodingProvider();
    });

    it('rejects empty address with validation error', async () => {
      const res = await geocodingProvider.geocode('');
      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe('VALIDATION_ERROR');
    });

    it('geocodes Anna Nagar landmark and computes valid precision-7 geohash', async () => {
      const res = await geocodingProvider.geocode('Anna Nagar Roundtana, Chennai');
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.latitude).toBeGreaterThanOrEqual(13.05);
      expect(res.data.latitude).toBeLessThanOrEqual(13.12);
      expect(res.data.longitude).toBeGreaterThanOrEqual(80.18);
      expect(res.data.longitude).toBeLessThanOrEqual(80.25);
      expect(res.data.pincode).toMatch(/^600\d{3}$/);
      expect(res.data.geohash).toHaveLength(7);
      expect(res.data.isWithinServiceBoundary).toBe(true);

      const expectedGeohash = encodeGeohash(res.data.latitude, res.data.longitude, 7);
      expect(res.data.geohash).toBe(expectedGeohash);
    });

    it('geocodes OMR Tidel Park with boundary compliance', async () => {
      const res = await geocodingProvider.geocode('Tidel Park, OMR, Chennai');
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.latitude).toBeGreaterThanOrEqual(12.95);
      expect(res.data.latitude).toBeLessThanOrEqual(13.05);
      expect(res.data.longitude).toBeGreaterThanOrEqual(80.22);
      expect(res.data.longitude).toBeLessThanOrEqual(80.28);
      expect(res.data.pincode).toMatch(/^600\d{3}$/);
      expect(res.data.isWithinServiceBoundary).toBe(true);
    });

    it('verifies offline landmark fallback path when network is unavailable', async () => {
      const offlineGeocoding = new RealGeocodingProvider({
        nominatimBaseUrl: 'http://127.0.0.1:59999/unreachable',
        timeoutMs: 50,
      });

      const resAnna = await offlineGeocoding.geocode('2nd Avenue, Anna Nagar Roundtana');
      expect(resAnna.success).toBe(true);
      if (!resAnna.success) return;
      expect(resAnna.data.latitude).toBeCloseTo(13.085, 2);
      expect(resAnna.data.longitude).toBeCloseTo(80.2101, 2);
      expect(resAnna.data.pincode).toBe('600040');
      expect(resAnna.data.isWithinServiceBoundary).toBe(true);

      const resOmr = await offlineGeocoding.geocode('OMR Tidel Park Tech Corridor Hub');
      expect(resOmr.success).toBe(true);
      if (!resOmr.success) return;
      expect(resOmr.data.latitude).toBeCloseTo(12.9897, 2);
      expect(resOmr.data.longitude).toBeCloseTo(80.2478, 2);
      expect(resOmr.data.pincode).toBe('600096');
      expect(resOmr.data.isWithinServiceBoundary).toBe(true);
    });

    it('identifies addresses outside Chennai service boundary', async () => {
      const res = await geocodingProvider.geocode('MG Road, Bangalore, Karnataka');
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.isWithinServiceBoundary).toBe(false);
      expect(res.data.latitude).toBeLessThan(13.0);
      expect(res.data.longitude).toBeLessThan(78.0);
    });

    it('reverse geocodes coordinates to address string', async () => {
      const res = await geocodingProvider.reverseGeocode(13.0382, 80.2314);
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data).toContain('Chennai');
    });

    it('rejects invalid coordinates in reverseGeocode', async () => {
      const res = await geocodingProvider.reverseGeocode(999, 80.2314);
      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('RealNotificationProvider', () => {
    let notificationProvider: RealNotificationProvider;

    beforeEach(() => {
      notificationProvider = new RealNotificationProvider({ enableConsoleAudit: false });
    });

    it('rejects empty recipient with validation error', async () => {
      const res = await notificationProvider.send({
        recipient: '',
        channel: 'SMS',
        message: 'Hello',
      });
      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects empty message with validation error', async () => {
      const res = await notificationProvider.send({
        recipient: '+919876543210',
        channel: 'SMS',
        message: '   ',
      });
      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe('VALIDATION_ERROR');
    });

    it('delivers SMS notification, generates delivery ID and logs audit', async () => {
      const res = await notificationProvider.send({
        recipient: '+919876543210',
        channel: 'SMS',
        message: 'Your OTP is 492019 for Parkly booking sp-tng-001',
        urgency: 'HIGH',
      });
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.delivered).toBe(true);
      expect(res.data.id).toMatch(/^notif_real_[a-f0-9]{8}$/);

      const logs = notificationProvider.getAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].recipient).toBe('+919876543210');
      expect(logs[0].channel).toBe('SMS');
      expect(logs[0].urgency).toBe('HIGH');
    });

    it('delivers Expo Push notification and stores audit entry', async () => {
      const res = await notificationProvider.send({
        recipient: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        channel: 'PUSH',
        title: 'Booking Confirmed',
        message: 'Your bay at T Nagar Parking Complex is ready.',
        metadata: { bookingId: 'bk_123', spaceId: 'sp-tng-001' },
      });
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.delivered).toBe(true);
      expect(res.data.id).toMatch(/^notif_real_/);

      const logs = notificationProvider.getAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].channel).toBe('PUSH');
      expect(logs[0].title).toBe('Booking Confirmed');
    });

    it('clears audit logs cleanly', async () => {
      await notificationProvider.send({
        recipient: 'user@parkly.in',
        channel: 'EMAIL',
        message: 'Your monthly invoice is available.',
      });
      expect(notificationProvider.getAuditLogs()).toHaveLength(1);

      notificationProvider.clearAuditLogs();
      expect(notificationProvider.getAuditLogs()).toHaveLength(0);
    });
  });
});
