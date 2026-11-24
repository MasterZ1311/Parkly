import { Result, AgentError } from '../../core';

export interface OcrExtractionResult {
  confidenceScore: number;
  rawText: string;
  extractedFields: {
    ownerName?: string;
    panNumber?: string;
    propertyTaxId?: string;
    address?: string;
    assessmentYear?: string;
  };
}

export interface IOcrTool {
  parseDocument(
    documentUrl: string,
    docType?: 'PAN' | 'PROPERTY_TAX' | 'DEED'
  ): Promise<Result<OcrExtractionResult, AgentError>>;
}
