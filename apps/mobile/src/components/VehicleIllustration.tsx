import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../constants/theme';

export type VehicleClass = 'motorcycle' | 'compact' | 'sedan' | 'suv' | 'van' | 'truck';

interface VehicleIllustrationProps {
  type?: VehicleClass | string;
  width?: number;
  height?: number;
  accentColor?: string;
  bodyColor?: string;
}

export function VehicleIllustration({
  type = 'sedan',
  width = 72,
  height = 40,
  accentColor = colors.primary,
  bodyColor = colors.navy,
}: VehicleIllustrationProps) {
  const normalized = (type || 'sedan').toLowerCase() as VehicleClass;

  const renderBody = () => {
    switch (normalized) {
      case 'motorcycle':
        return (
          <>
            <Circle cx="24" cy="40" r="9" fill="none" stroke={bodyColor} strokeWidth="4" />
            <Circle cx="74" cy="40" r="9" fill="none" stroke={bodyColor} strokeWidth="4" />
            <Path
              d="M24 40L36 22H52L62 28L74 40M48 22L54 14H64"
              fill="none"
              stroke={bodyColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path d="M35 23H49L44 29H31Z" fill={accentColor} />
            <Circle cx="24" cy="40" r="3" fill={accentColor} />
            <Circle cx="74" cy="40" r="3" fill={accentColor} />
          </>
        );
      case 'compact':
        return (
          <>
            <Path
              d="M14 35V28L25 14H60L75 24L86 27V35H14Z"
              fill={bodyColor}
            />
            <Path d="M28 16H57L68 24H25Z" fill="#E8EEF6" />
            <Rect x="13" y="29" width="6" height="4" rx="1.5" fill={accentColor} />
            <Rect x="82" y="29" width="5" height="4" rx="1.5" fill="#FDE68A" />
            <Circle cx="28" cy="37" r="7" fill={colors.surface} stroke={bodyColor} strokeWidth="3.5" />
            <Circle cx="72" cy="37" r="7" fill={colors.surface} stroke={bodyColor} strokeWidth="3.5" />
          </>
        );
      case 'suv':
        return (
          <>
            <Path
              d="M10 36V22L18 11H66L78 21L89 24V36H10Z"
              fill={bodyColor}
            />
            <Path d="M21 14H63L72 22H18Z" fill="#E8EEF6" />
            <Rect x="44" y="14" width="3" height="8" fill={bodyColor} />
            <Rect x="10" y="25" width="6" height="5" rx="1.5" fill={accentColor} />
            <Rect x="84" y="26" width="5" height="4" rx="1.5" fill="#FDE68A" />
            <Circle cx="27" cy="37" r="7.5" fill={colors.surface} stroke={bodyColor} strokeWidth="3.5" />
            <Circle cx="73" cy="37" r="7.5" fill={colors.surface} stroke={bodyColor} strokeWidth="3.5" />
          </>
        );
      case 'van':
      case 'truck':
        return (
          <>
            <Path
              d="M10 36V14H66L80 23L89 26V36H10Z"
              fill={bodyColor}
            />
            <Path d="M58 17H66L76 24H58Z" fill="#E8EEF6" />
            <Rect x="15" y="18" width="36" height="8" rx="2" fill="#E8EEF6" />
            <Rect x="10" y="28" width="6" height="4" rx="1.5" fill={accentColor} />
            <Circle cx="26" cy="37" r="7" fill={colors.surface} stroke={bodyColor} strokeWidth="3.5" />
            <Circle cx="73" cy="37" r="7" fill={colors.surface} stroke={bodyColor} strokeWidth="3.5" />
          </>
        );
      case 'sedan':
      default:
        return (
          <>
            <Path
              d="M10 35V26L24 14H58L73 23L89 26V35H10Z"
              fill={bodyColor}
            />
            <Path d="M27 16H55L67 23H22Z" fill="#E8EEF6" />
            <Rect x="42" y="16" width="2.5" height="7" fill={bodyColor} />
            <Rect x="10" y="27" width="6" height="4" rx="1.5" fill={accentColor} />
            <Rect x="84" y="28" width="5" height="4" rx="1.5" fill="#FDE68A" />
            <Circle cx="27" cy="37" r="7" fill={colors.surface} stroke={bodyColor} strokeWidth="3.5" />
            <Circle cx="73" cy="37" r="7" fill={colors.surface} stroke={bodyColor} strokeWidth="3.5" />
          </>
        );
    }
  };

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={width} height={height} viewBox="0 0 100 54">
        <Rect x="12" y="45" width="76" height="3" rx="1.5" fill={colors.border} />
        {renderBody()}
      </Svg>
    </View>
  );
}

export default VehicleIllustration;
