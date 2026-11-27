import React, { useEffect } from 'react';
import { Platform, Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '../constants/theme';

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);
export const EASE_PRESS = Easing.bezier(0.25, 0.1, 0.25, 1);

// Defined at module scope so Reanimated layout builders remain stable across renders
export const ENTER_FADE_UP = FadeInDown.duration(260)
  .easing(EASE_OUT)
  .reduceMotion(ReduceMotion.System);

export const CHIP_LAYOUT_TRANSITION = LinearTransition.duration(200)
  .easing(EASE_OUT)
  .reduceMotion(ReduceMotion.System);

export function triggerHaptic(kind: 'light' | 'medium' | 'selection' | 'success' | 'none') {
  if (kind === 'none' || Platform.OS === 'web') return;
  try {
    if (kind === 'selection') {
      Haptics.selectionAsync().catch(() => {});
    } else if (kind === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (kind === 'medium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  } catch {
    // Graceful no-op on unsupported hardware
  }
}

interface PressScaleProps {
  onPress?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  rippleColor?: string;
  haptic?: 'light' | 'medium' | 'selection' | 'none';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'link';
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  children: React.ReactNode;
}

export function PressScale({
  onPress,
  disabled = false,
  scaleTo = 0.97,
  rippleColor = colors.rippleDark,
  haptic = 'light',
  style,
  contentStyle,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  children,
}: PressScaleProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const handlePressIn = () => {
    if (disabled || reducedMotion) return;
    scale.set(withTiming(scaleTo, { duration: 110, easing: EASE_PRESS }));
  };

  const handlePressOut = () => {
    if (reducedMotion) {
      scale.set(1);
      return;
    }
    scale.set(withTiming(1, { duration: 160, easing: EASE_OUT }));
  };

  const handlePress = () => {
    if (disabled) return;
    triggerHaptic(haptic);
    onPress?.();
  };

  return (
    <Animated.View style={[style, animatedStyle]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        android_ripple={{ color: rippleColor, borderless: false }}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        style={[{ minHeight: 48 }, contentStyle]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

interface SkeletonBlockProps {
  height?: number;
  width?: number | `${number}%`;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonBlock({
  height = 88,
  width = '100%',
  borderRadius = 14,
  style,
}: SkeletonBlockProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (reducedMotion) {
      opacity.set(0.7);
      return;
    }
    opacity.set(
      withRepeat(
        withTiming(0.95, { duration: 850, easing: EASE_IN_OUT }),
        -1,
        true
      )
    );
  }, [reducedMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
  }));

  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius,
          backgroundColor: '#E5E2D8',
          borderWidth: 1,
          borderColor: colors.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
