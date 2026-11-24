import { Result, ok, err, AgentError } from '../../core';
import { IOcrTool, OcrExtractionResult } from '../interfaces/ocr-tool.interface';
import { MOCK_DOCUMENTS } from '../../fixtures/mock-documents.fixture';

export class MockOcrProvider implements IOcrTool {
  private simulatedConfidence: number | null = null;
  private simulatedFailure = false;
  private customFields: Record<string, string> = {};

  public setSimulatedConfidence(score: number): void {
    this.simulatedConfidence = score;
  }

  public setExtractedFields(fields: Record<string, string>): void {
    this.customFields = { ...fields };
  }

  public simulateFailure(shouldFail: boolean): void {
    this.simulatedFailure = shouldFail;
  }

  public async parseDocument(
    documentUrl: string,
    docType: 'PAN' | 'PROPERTY_TAX' | 'DEED' = 'PAN'
  ): Promise<Result<OcrExtractionResult, AgentError>> {
    if (this.simulatedFailure) {
      return err(AgentError.downstream('Mock OCR extraction failed due to simulated error'));
    }

    if (documentUrl.includes('blurry')) {
      const confidence = this.simulatedConfidence ?? MOCK_DOCUMENTS.blurryPan.confidenceScore;
      return ok({
        confidenceScore: confidence,
        rawText: 'INCOME TAX DEPT... PAN: A3C0E1234? NAME: Suresh K????',
        extractedFields: {
          ...MOCK_DOCUMENTS.blurryPan.extractedIdentity,
          ...this.customFields,
        },
      });
    }

    if (docType === 'PROPERTY_TAX' || documentUrl.includes('tax')) {
      const isCommercial = documentUrl.includes('commercial');
      return ok({
        confidenceScore: this.simulatedConfidence ?? 0.95,
        rawText: `GREATER CHENNAI CORPORATION TAX RECEIPT ID: ${
          isCommercial
            ? MOCK_DOCUMENTS.commercialTax.extractedIdentity.propertyTaxId
            : MOCK_DOCUMENTS.validPropertyTax.extractedIdentity.propertyTaxId
        }`,
        extractedFields: {
          ownerName: 'Suresh Krishnan',
          propertyTaxId: isCommercial
            ? MOCK_DOCUMENTS.commercialTax.extractedIdentity.propertyTaxId
            : MOCK_DOCUMENTS.validPropertyTax.extractedIdentity.propertyTaxId,
          assessmentYear: '2024-2025',
          address: '14 Burkit Road, T. Nagar, Chennai 600017',
          ...this.customFields,
        },
      });
    }

    // Default valid PAN
    return ok({
      confidenceScore: this.simulatedConfidence ?? MOCK_DOCUMENTS.validPan.confidenceScore,
      rawText: 'INCOME TAX DEPARTMENT GOVT OF INDIA PAN: ABCDE1234F NAME: Suresh Krishnan',
      extractedFields: {
        ...MOCK_DOCUMENTS.validPan.extractedIdentity,
        ...this.customFields,
      },
    });
  }

  public reset(): void {
    this.simulatedConfidence = null;
    this.simulatedFailure = false;
    this.customFields = {};
  }
}
