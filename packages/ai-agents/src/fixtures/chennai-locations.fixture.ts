export interface ChennaiLocationFixture {
  readonly id: string;
  readonly name: string;
  readonly rawAddress: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly geohash: string;
  readonly pincode: string;
  readonly zone?: string;
  readonly ward?: string;
  readonly hourlyRate: number;
  readonly isCovered: boolean;
  readonly hasCctv: boolean;
  readonly hasEvCharging: boolean;
  readonly totalSlots: number;
  readonly distanceMeters?: number;
}

export const CHENNAI_LOCATIONS = {
  tNagarBurkit: {
    id: 'spc_tnagar_burkit_01',
    name: 'Burkit Road Covered Bay',
    rawAddress: '14 Burkit Road, T. Nagar, Chennai, Tamil Nadu 600017',
    latitude: 13.0382,
    longitude: 80.2314,
    geohash: 'tf341tw',
    pincode: '600017',
    zone: 'Zone 10 Kodambakkam',
    ward: 'Ward 134',
    hourlyRate: 40,
    isCovered: true,
    hasCctv: true,
    hasEvCharging: false,
    totalSlots: 2,
  },
  pothysRetail: {
    id: 'poi_tnagar_pothys',
    name: 'Pothys Retail Usman Road',
    rawAddress: '15 Usman Road, T. Nagar, Chennai, Tamil Nadu 600017',
    latitude: 13.0418,
    longitude: 80.2341,
    geohash: 'tf341y0',
    pincode: '600017',
    hourlyRate: 60,
    isCovered: true,
    hasCctv: true,
    hasEvCharging: false,
    totalSlots: 4,
  },
  annaNagarRoundtana: {
    id: 'spc_annanagar_round_01',
    name: '2nd Avenue Metro Park-and-Ride',
    rawAddress: '2nd Avenue, Anna Nagar, Chennai, Tamil Nadu 600040',
    latitude: 13.085,
    longitude: 80.2101,
    geohash: 'tf343np',
    pincode: '600040',
    zone: 'Zone 8 Anna Nagar',
    ward: 'Ward 102',
    hourlyRate: 35,
    isCovered: false,
    hasCctv: true,
    hasEvCharging: true,
    totalSlots: 6,
  },
  omrTidelPark: {
    id: 'spc_omr_tidel_01',
    name: 'Tidel Park Tech Corridor Hub',
    rawAddress: 'Rajiv Gandhi Salai, Taramani / OMR, Chennai, Tamil Nadu 600096',
    latitude: 12.9897,
    longitude: 80.2478,
    geohash: 'tf31fhd',
    pincode: '600096',
    zone: 'Zone 13 Adyar',
    ward: 'Ward 174',
    hourlyRate: 50,
    isCovered: true,
    hasCctv: true,
    hasEvCharging: true,
    totalSlots: 15,
  },
  tNagarBackupBay: {
    id: 'spc_tnagar_backup_bay_02',
    name: 'Burkit Road West Backup Bay',
    rawAddress: '28 Burkit Road, T. Nagar, Chennai, Tamil Nadu 600017',
    latitude: 13.0375,
    longitude: 80.2305,
    geohash: 'tf341tq',
    pincode: '600017',
    hourlyRate: 40,
    isCovered: true,
    hasCctv: true,
    hasEvCharging: false,
    totalSlots: 1,
    distanceMeters: 140, // strictly <= 200m
  },
} as const;
