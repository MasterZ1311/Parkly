import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import * as QrCore from 'qrcode/lib/core/qrcode';
import { colors } from '../constants/theme';

export interface QrMatrixSpec {
  size: number;
  pathData: string;
}

/**
 * Generates an SVG path string representing every dark module in the QR matrix.
 * Pure synchronous JS via qrcode/lib/core/qrcode — zero network calls or Node builtins.
 */
export function buildQrMatrixPath(
  value: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M',
): QrMatrixSpec {
  const payload = value.trim() || 'PARKLY:OFFLINE';
  const qr = QrCore.create(payload, { errorCorrectionLevel });
  const { size, data } = qr.modules;

  const segments: string[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (data[row * size + col]) {
        segments.push(`M${col},${row}h1v1h-1z`);
      }
    }
  }

  return {
    size,
    pathData: segments.join(''),
  };
}

interface QrPassSvgProps {
  value: string;
  size?: number;
  quietZone?: number;
  darkColor?: string;
  lightColor?: string;
  accessibilityLabel?: string;
}

export function QrPassSvg({
  value,
  size = 180,
  quietZone = 2,
  darkColor = colors.navy,
  lightColor = colors.white,
  accessibilityLabel = 'Offline scannable QR gate pass',
}: QrPassSvgProps) {
  const matrix = useMemo(() => buildQrMatrixPath(value, 'M'), [value]);
  const totalUnits = matrix.size + quietZone * 2;
  const viewBox = `${-quietZone} ${-quietZone} ${totalUnits} ${totalUnits}`;

  return (
    <View
      style={[styles.frame, { width: size, height: size, backgroundColor: lightColor }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox={viewBox}>
        <Rect
          x={-quietZone}
          y={-quietZone}
          width={totalUnits}
          height={totalUnits}
          fill={lightColor}
        />
        <Path d={matrix.pathData} fill={darkColor} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default QrPassSvg;
