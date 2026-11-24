export const MOCK_DOCUMENTS = {
  validPan: {
    url: 'https://s3.ap-south-1.amazonaws.com/parkly-kyc/doc_pan_valid_01.jpg',
    docType: 'PAN',
    confidenceScore: 0.96,
    extractedIdentity: {
      ownerName: 'Suresh Krishnan',
      panNumber: 'ABCDE1234F',
    },
  },
  blurryPan: {
    url: 'https://s3.ap-south-1.amazonaws.com/parkly-kyc/doc_pan_blurry_02.jpg',
    docType: 'PAN',
    confidenceScore: 0.71, // < 0.85 -> triggers MANUAL_REVIEW_REQUIRED
    extractedIdentity: {
      ownerName: 'Suresh K????',
      panNumber: 'A3C0E1234?',
    },
  },
  validPropertyTax: {
    url: 'https://s3.ap-south-1.amazonaws.com/parkly-kyc/doc_tax_valid_01.pdf',
    docType: 'PROPERTY_TAX',
    confidenceScore: 0.94,
    extractedIdentity: {
      propertyTaxId: 'CORP-CHN-2024-88192',
      ownerName: 'Suresh Krishnan',
      assessmentYear: '2024-2025',
    },
    zoningClassification: 'RESIDENTIAL_PERMITTED',
  },
  commercialTax: {
    url: 'https://s3.ap-south-1.amazonaws.com/parkly-kyc/doc_tax_commercial_03.pdf',
    docType: 'PROPERTY_TAX',
    confidenceScore: 0.91,
    extractedIdentity: {
      propertyTaxId: 'CORP-CHN-2024-99102',
    },
    zoningClassification: 'NON_RESIDENTIAL_PROHIBITED', // triggers MANUAL_REVIEW_REQUIRED
  },
} as const;
