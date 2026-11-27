declare module 'qrcode/lib/core/qrcode' {
  export interface QrCoreMatrix {
    size: number;
    data: Uint8Array;
    get(row: number, col: number): number;
  }

  export interface QrCoreResult {
    modules: QrCoreMatrix;
    version: number;
  }

  export function create(
    text: string,
    options?: {
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
      version?: number;
    },
  ): QrCoreResult;
}
