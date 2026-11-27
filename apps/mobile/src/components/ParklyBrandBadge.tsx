import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

type BrandBadgeSize = 'sm' | 'md' | 'lg';

interface ParklyBrandBadgeProps {
  size?: BrandBadgeSize;
  darkSurface?: boolean;
}

const BADGE_METRICS: Record<
  BrandBadgeSize,
  {
    boxSize: number;
    letterSize: number;
    pinSize: number;
    radius: number;
    pinOffsetBottom: number;
    pinOffsetRight: number;
  }
> = {
  sm: { boxSize: 44, letterSize: 21, pinSize: 13, radius: 12, pinOffsetBottom: 4, pinOffsetRight: 3 },
  md: { boxSize: 64, letterSize: 30, pinSize: 18, radius: 17, pinOffsetBottom: 6, pinOffsetRight: 5 },
  lg: { boxSize: 84, letterSize: 40, pinSize: 24, radius: 22, pinOffsetBottom: 8, pinOffsetRight: 8 },
};

export function ParklyBrandBadge({ size = 'sm', darkSurface = false }: ParklyBrandBadgeProps) {
  const { boxSize, letterSize, pinSize, radius, pinOffsetBottom, pinOffsetRight } =
    BADGE_METRICS[size];

  return (
    <View
      style={[
        styles.badge,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: radius,
          backgroundColor: darkSurface ? colors.white : colors.navy,
          borderColor: darkSurface ? colors.border : colors.navyBorder,
        },
      ]}
    >
      <Text
        style={[
          styles.letter,
          {
            fontSize: letterSize,
            color: darkSurface ? colors.navy : colors.white,
          },
        ]}
      >
        P
      </Text>
      <View
        style={[
          styles.pinBadge,
          {
            width: pinSize + 6,
            height: pinSize + 6,
            borderRadius: (pinSize + 6) / 2,
            bottom: pinOffsetBottom,
            right: pinOffsetRight,
          },
        ]}
      >
        <Ionicons name="location" size={pinSize} color={colors.white} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  letter: {
    fontWeight: '900',
    letterSpacing: -1,
    includeFontPadding: false,
  },
  pinBadge: {
    position: 'absolute',
    backgroundColor: colors.brandAccent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
});
