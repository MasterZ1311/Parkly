export const MOCK_PHOTOS = {
  approvedSpace: {
    photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly-spaces/photo_approved_01.jpg'],
    gateClearance: 2.8, // >= 2.2m threshold
    gateWidth: 3.2,
    isCovered: true,
    surfaceType: 'concrete_paved',
    cctvVisible: true,
    lightingAdequate: true,
    evChargerDetected: false,
    obstructions: [] as string[],
    licensePlatesBlurred: 1,
    facesBlurred: 0,
    inspectionResult: 'APPROVED' as const,
  },
  narrowGateObstruction: {
    photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly-spaces/photo_rejected_02.jpg'],
    gateClearance: 2.1, // < 2.2m threshold -> ACTION_REQUIRED
    gateWidth: 1.9,
    isCovered: false,
    surfaceType: 'gravel',
    obstructions: ['parked_scooter', 'loose_debris'],
    licensePlatesBlurred: 2,
    facesBlurred: 1,
    inspectionResult: 'ACTION_REQUIRED' as const,
    feedbackMessages: [
      'Gate clearance 2.10m is below 2.20m minimum standard',
      'Remove parked scooter and debris obstructing entryway',
    ],
  },
} as const;
