// services/pushTokenService.ts
// Registers Expo push token and saves it to Firestore under users/{uid}.expoPushToken
// Call registerPushToken(uid) once after user logs in / on app launch

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/config/firebase';

// ─── Notification handler (foreground) ────────────────────────────────────────
// This makes sure banners appear even when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Register & save token ─────────────────────────────────────────────────────
export async function registerPushToken(uid: string): Promise<string | null> {
  // Push notifications only work on real devices
  if (!Device.isDevice) {
    console.warn('[Push] Skipped: emulator/simulator detected');
    return null;
  }

  try {
    // 1. Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push] Permission denied by user');
      return null;
    }

    // 2. Android channel (required for Android 8+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'FurrEver Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F4A900',
        sound: 'default',
      });
    }

    // 3. Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'ad7b2d2d-6305-4234-83af-5f751746426c', // from app.json extra.eas.projectId
    });
    const token = tokenData.data;

    // 4. Save to Firestore
    await updateDoc(doc(firestore, 'users', uid), {
      expoPushToken: token,
      pushTokenUpdatedAt: new Date().toISOString(),
      platform: Platform.OS,
    });

    console.log('[Push] Token registered:', token);
    return token;
  } catch (error) {
    console.error('[Push] Registration error:', error);
    return null;
  }
}

// ─── Send push via Expo Push API (call from RN side for peer-to-peer) ──────────
// Use this only for chat notifications from within the app.
// Admin broadcasts go through the web API → Expo Push API server-side.
export async function sendExpoPush(
  expoPushToken: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  if (!expoPushToken?.startsWith('ExponentPushToken')) {
    console.warn('[Push] Invalid token format, skipping send');
    return;
  }

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId: 'default',
      }),
    });
  } catch (error) {
    console.error('[Push] Send error:', error);
  }
}