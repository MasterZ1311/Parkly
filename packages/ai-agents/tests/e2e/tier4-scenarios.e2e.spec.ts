/**
 * 🅿️ Parkly — Tier 4: Real-World Chennai Mobility Scenarios E2E Test Suite
 * 
 * Verifies 8 comprehensive Chennai urban mobility scenarios
 * strictly conforming to TEST_INFRA.md §5.4.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  E2ETestHarness,
  expectSuccess,
  CHENNAI_LOCATIONS,
  MOCK_DOCUMENTS,
  ExecutionContext,
} from './helpers/e2e-harness';

describe('Tier 4: Real-World Chennai Mobility Scenarios (8 scenarios)', () => {
  let harness: E2ETestHarness;
  let ctx: ExecutionContext;

  beforeEach(async () => {
    harness = await E2ETestHarness.create();
    ctx = harness.createContext('usr_chennai_driver');
  });

  // ==========================================================================
  // SCENARIO 1: T. Nagar Festival Shopping Rush (Diwali Peak)
  // ==========================================================================
  it('Scenario 1: T. Nagar Festival Shopping Rush (Diwali Peak)', async () => {
    // 1. Driver queries concierge near Pothys
    const conciergeRes = await harness.agents.driverConcierge.execute({
      driverId: 'usr_diwali_shopper',
      query: 'Find covered parking under 80/hr near Pothys for 2h',
      currentLocation: {
        latitude: CHENNAI_LOCATIONS.pothysRetail.latitude,
        longitude: CHENNAI_LOCATIONS.pothysRetail.longitude,
      },
    }, ctx);
    expectSuccess(conciergeRes);
    expect(conciergeRes.data.action).toBe('PRESENT_RECOMMENDATION');

    // 2. Predictor checks festival surge (0.92 occupancy)
    const predRes = await harness.agents.occupancyPredictor.execute({
      spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
      targetArrivalTime: '2026-10-31T17:00:00.000Z',
      targetDurationMinutes: 120,
    }, ctx);
    expectSuccess(predRes);
    expect(predRes.data.demandTier).toBe('PEAK_SHOPPING');

    // 3. Dynamic pricing evaluates surge (40 base -> 64 with 1.6x multiplier within 1.8x cap)
    const priceRes = await harness.agents.dynamicPricing.execute({
      spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
      baseHourlyRate: 40,
      currentOccupancyRate: 0.92,
      hostPricingPreferences: { allowDynamic: true, maxMultiplier: 1.8 },
    }, ctx);
    expectSuccess(priceRes);
    expect(priceRes.data.calculatedHourlyRate).toBe(64);
    expect(priceRes.data.appliedMultiplier).toBe(1.6);

    // 4. Booking hold saga places hold with QR code
    const holdRes = await harness.sagas.bookingHold.execute({
      spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
      driverId: 'usr_diwali_shopper',
      baseHourlyRate: 40,
      durationHours: 2,
    }, ctx);
    expectSuccess(holdRes);
    expect(holdRes.data.qrCode).toContain('PARKLY-QR');
  });

  // ==========================================================================
  // SCENARIO 2: Anna Nagar Commuter Metro Park-and-Ride
  // ==========================================================================
  it('Scenario 2: Anna Nagar Commuter Metro Park-and-Ride (08:30 AM commute)', async () => {
    // 1. Commuter requests 9-hour park-and-ride (08:30 to 17:30)
    const predRes = await harness.agents.occupancyPredictor.execute({
      spaceId: CHENNAI_LOCATIONS.annaNagarRoundtana.id,
      targetArrivalTime: '2026-09-07T08:30:00.000Z',
      targetDurationMinutes: 540,
    }, ctx);
    expectSuccess(predRes);
    expect(predRes.data.demandTier).toBe('PEAK_COMMUTE');

    // 2. Dynamic pricing computes commute rush surge (35 base * 1.25 -> 44)
    const priceRes = await harness.agents.dynamicPricing.execute({
      spaceId: CHENNAI_LOCATIONS.annaNagarRoundtana.id,
      baseHourlyRate: 35,
      currentOccupancyRate: 0.75,
    }, ctx);
    expectSuccess(priceRes);
    expect(priceRes.data.calculatedHourlyRate).toBe(44);

    // 3. Booking hold saga acquires hold
    const holdRes = await harness.sagas.bookingHold.execute({
      spaceId: CHENNAI_LOCATIONS.annaNagarRoundtana.id,
      driverId: 'usr_anna_commuter',
      baseHourlyRate: 35,
      durationHours: 9,
    }, ctx);
    expectSuccess(holdRes);

    // 4. Confirm booking
    const confirmRes = await harness.mocks.booking.confirmBooking(holdRes.data.bookingId);
    expectSuccess(confirmRes);

    const holds = harness.mocks.booking.getActiveHolds();
    const confirmed = holds.find((h) => h.bookingId === holdRes.data.bookingId);
    expect(confirmed?.status).toBe('confirmed');
  });

  // ==========================================================================
  // SCENARIO 3: OMR IT Corridor Overnight Shift Parking
  // ==========================================================================
  it('Scenario 3: OMR IT Corridor Overnight Shift Parking with EV Charging', async () => {
    // 1. Driver searches with EV filter near Tidel Park
    const conciergeRes = await harness.agents.driverConcierge.execute({
      driverId: 'usr_omr_techie',
      query: 'Need overnight EV parking near Tidel Park',
      currentLocation: {
        latitude: CHENNAI_LOCATIONS.omrTidelPark.latitude,
        longitude: CHENNAI_LOCATIONS.omrTidelPark.longitude,
      },
    }, ctx);
    expectSuccess(conciergeRes);
    expect(conciergeRes.data.action).toBe('PRESENT_RECOMMENDATION');

    // 2. Booking hold saga issues pass
    const holdRes = await harness.sagas.bookingHold.execute({
      spaceId: CHENNAI_LOCATIONS.omrTidelPark.id,
      driverId: 'usr_omr_techie',
      baseHourlyRate: 50,
      durationHours: 8,
    }, ctx);
    expectSuccess(holdRes);
    expect(holdRes.data.qrCode).toContain(CHENNAI_LOCATIONS.omrTidelPark.id);
  });

  // ==========================================================================
  // SCENARIO 4: T. Nagar Shopper Overstay Dispute Resolution
  // ==========================================================================
  it('Scenario 4: T. Nagar Shopper Overstay Dispute Resolution (90 min overstay)', async () => {
    harness.mocks.sensor.setOverstayMinutes(90);
    harness.mocks.sensor.setVehiclePresent(true);

    const disputeRes = await harness.agents.disputeMediation.execute({
      disputeId: 'disp_sc4_01',
      bookingId: 'bk_sc4_01',
      incidentType: 'OVERSTAY_REPORTED',
      reportedBy: 'usr_host_burkit',
      evidence: { claimAmount: 100 },
    }, ctx);

    expectSuccess(disputeRes);
    expect(disputeRes.data.adjudication).toBe('OVERSTAY_CONFIRMED');
    expect(disputeRes.data.hostCompensationAmount).toBe(100);

    const txs = harness.mocks.ledger.getTransactions();
    expect(txs.some((t) => t.action === 'CHARGE_PENALTY' && t.status === 'SUCCESS')).toBe(true);
    expect(txs.some((t) => t.action === 'CREDIT_HOST' && t.status === 'SUCCESS')).toBe(true);

    const notifs = harness.mocks.notification.getSentNotifications();
    expect(notifs.some((n) => n.message.includes('Overstay confirmed'))).toBe(true);
  });

  // ==========================================================================
  // SCENARIO 5: High-Value Dispute Escalation & Payout Freeze
  // ==========================================================================
  it('Scenario 5: High-Value Dispute Escalation & Payout Freeze (₹2,500 claim)', async () => {
    const disputeRes = await harness.agents.disputeMediation.execute({
      disputeId: 'disp_sc5_01',
      bookingId: 'bk_sc5_01',
      incidentType: 'GATE_DAMAGE_EXTREME_OVERSTAY',
      reportedBy: 'usr_host_annanagar',
      evidence: { claimAmount: 2500 },
    }, ctx);

    expectSuccess(disputeRes);
    expect(disputeRes.data.adjudication).toBe('ESCALATED_MANUAL');
    expect(disputeRes.data.hostCompensationAmount).toBe(0);
    expect(disputeRes.data.actionsTaken).toContain('PAYOUT_FROZEN_HIGH_VALUE_THRESHOLD');

    // Assert zero automatic funds credited
    const txs = harness.mocks.ledger.getTransactions();
    const successfulCredits = txs.filter((t) => t.action === 'CREDIT_HOST' && t.status === 'SUCCESS');
    expect(successfulCredits.length).toBe(0);
  });

  // ==========================================================================
  // SCENARIO 6: Gate Access Blockage & Autonomous 200m Relocation
  // ==========================================================================
  it('Scenario 6: Gate Access Blockage & Autonomous Relocation to Backup Bay within 140m @ ₹0 Surcharge', async () => {
    harness.mocks.traffic.setBlockedAccess(true);

    const conciergeRes = await harness.agents.driverConcierge.execute({
      driverId: 'usr_blocked_driver',
      query: 'Parking on Burkit Road near Usman Road',
      currentLocation: {
        latitude: CHENNAI_LOCATIONS.tNagarBurkit.latitude,
        longitude: CHENNAI_LOCATIONS.tNagarBurkit.longitude,
      },
    }, ctx);

    expectSuccess(conciergeRes);
    expect(conciergeRes.data.relocationTriggered).toBe(true);
    expect(conciergeRes.data.recommendedSpace?.id).toBe(CHENNAI_LOCATIONS.tNagarBackupBay.id);
    expect(conciergeRes.data.recommendedSpace?.hourlyRate).toBe(40); // 0 surcharge
    expect(conciergeRes.data.entryInstructions).toContain('140m');
  });

  // ==========================================================================
  // SCENARIO 7: Blurry GCC Property Tax Receipt KYC Escalation
  // ==========================================================================
  it('Scenario 7: Blurry GCC Property Tax Receipt KYC Escalation (< 0.85 confidence)', async () => {
    harness.mocks.ocr.setSimulatedConfidence(0.71); // Blurry document

    const onboardingRes = await harness.sagas.hostOnboarding.execute({
      userId: 'usr_mylapore_blurry',
      rawAddress: '28 Kutchery Road, Mylapore, Chennai 600004',
      documentUrls: [MOCK_DOCUMENTS.blurryPan.url],
      declaredSlots: 1,
      vehicleTypes: ['sedan'],
    }, ctx);

    expectSuccess(onboardingRes);
    expect(onboardingRes.data.sagaStatus).toBe('PAUSED_MANUAL_REVIEW');
    expect(onboardingRes.data.kycStatus).toBe('MANUAL_REVIEW_REQUIRED');

    // Ensure listing is not activated
    expect((onboardingRes.data as any).listingActive).toBeUndefined();
  });

  // ==========================================================================
  // SCENARIO 8: Greater Chennai Corporation (GCC) Weekly Mobility Intelligence Report
  // ==========================================================================
  it('Scenario 8: Greater Chennai Corporation (GCC) Weekly Mobility Intelligence Report ("2026-W36")', async () => {
    const reportRes = await harness.agents.cityAnalytics.execute({
      cityId: 'chennai',
      period: '2026-W36',
      zones: ['Zone 10 Kodambakkam', 'Zone 8 Anna Nagar', 'Zone 13 Adyar'],
    }, ctx);

    expectSuccess(reportRes);
    expect(reportRes.data.cityId).toBe('chennai');
    expect(reportRes.data.metrics.totalOffStreetHoursProvided).toBe(48200);
    expect(reportRes.data.metrics.estimatedCurbsideCruisingReducedMinutes).toBe(184000);
    expect(reportRes.data.metrics.estimatedCO2AbatedKg).toBe(4213.6); // 184,000 * 0.0229
    expect(reportRes.data.metrics.unmetDemandChokePoints.length).toBeGreaterThan(0);
    expect(reportRes.data.recommendation).toContain('Usman Rd');
  });
});
