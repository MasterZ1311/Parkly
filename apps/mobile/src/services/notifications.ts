import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { notificationApi } from '../api/client';
import { cacheGet, CACHE_KEYS } from '../utils/cache';

export const DEFAULT_CHANNEL_ID = 'parkly_default';

let handlerConfigured = false;

export function configureNotifications(): void {
  if (handlerConfigured || Platform.OS === 'web') return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: 'Parkly Gate & Booking Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 120, 220],
      lightColor: '#D90410',
      sound: 'default',
    }).catch(() => {});
  }
}

export interface PushRegistrationResult {
  granted: boolean;
  token?: string;
  platform: 'android' | 'ios' | 'expo' | 'web';
  registeredOnServer: boolean;
}

export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus | 'unsupported'> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const perms = await Notifications.getPermissionsAsync();
    return perms.status;
  } catch {
    return 'unsupported';
  }
}

export async function registerForPushNotificationsAsync(
  syncWithServer = true,
): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { granted: false, platform: 'web', registeredOnServer: false };
  }

  configureNotifications();

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return {
        granted: false,
        platform: Platform.OS === 'android' ? 'android' : 'ios',
        registeredOnServer: false,
      };
    }

    let pushToken: string | undefined;
    const projectId =
      Constants?.expoConfig?.extra?.['eas']?.['projectId'] ||
      Constants?.easConfig?.projectId;

    if (Device.isDevice && projectId) {
      try {
        const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
        pushToken = tokenResp.data;
      } catch {
        // Fallback to native device token below
      }
    }

    if (!pushToken) {
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        if (typeof deviceToken?.data === 'string' && deviceToken.data.length > 0) {
          pushToken = deviceToken.data;
        }
      } catch {
        // Emulator or missing Play Services — fall back to deterministic local registration ID
        pushToken = `local-${Platform.OS}-${Device.modelName || 'device'}`;
      }
    }

    const platform: 'android' | 'ios' | 'expo' =
      Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'expo';

    let registeredOnServer = false;
    if (syncWithServer && pushToken) {
      try {
        await notificationApi.registerDevice(pushToken, platform);
        registeredOnServer = true;
      } catch {
        registeredOnServer = false;
      }
    }

    return {
      granted: true,
      token: pushToken,
      platform,
      registeredOnServer,
    };
  } catch {
    return {
      granted: false,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
      registeredOnServer: false,
    };
  }
}

export async function scheduleBookingReminderNotification(params: {
  bookingId: string;
  spaceName: string;
  endTimeIso: string;
  vehiclePlate?: string;
}): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const prefs = await cacheGet<{ bookingReminders?: boolean }>(CACHE_KEYS.NOTIFICATION_PREFS);
    if (prefs && prefs.bookingReminders === false) {
      return null;
    }

    const perms = await Notifications.getPermissionsAsync();
    if (perms.status !== 'granted') {
      return null;
    }

    const endMs = new Date(params.endTimeIso).getTime();
    const nowMs = Date.now();
    // Remind 15 minutes before checkout, or 10 seconds from now for short sessions
    const triggerMs = endMs - 15 * 60 * 1000;
    const secondsUntil = Math.max(10, Math.round((triggerMs - nowMs) / 1000));

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `Gate Pass Active · ${params.spaceName}`,
        body: params.vehiclePlate
          ? `Vehicle ${params.vehiclePlate} checkout reminder — tap to view QR gate pass or extend.`
          : 'Your parking checkout window is approaching — tap to view QR pass or extend.',
        data: { bookingId: params.bookingId, route: `/booking/${params.bookingId}` },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
        channelId: Platform.OS === 'android' ? DEFAULT_CHANNEL_ID : undefined,
      },
    });
  } catch {
    return null;
  }
}

export async function sendTestLocalNotification(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  configureNotifications();
  try {
    const perms = await Notifications.getPermissionsAsync();
    if (perms.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== 'granted') return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Parkly Chennai Alerts Ready',
        body: 'Gate pass reminders and UPI payment confirmations are active on this device.',
        data: { route: '/(tabs)/bookings' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: Platform.OS === 'android' ? DEFAULT_CHANNEL_ID : undefined,
      },
    });
    return true;
  } catch {
    return false;
  }
}
