// services/pushTokenService.ts
// Registers Expo push token with custom FurrEver notification channel
// Saves token to Firestore users/{uid}.expoPushToken

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { firestore } from '@/config/firebase';

// ─── IMPORTANT: Set this at module level, runs before anything else ───────────
// This controls how notifications appear when app is in FOREGROUND
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   // Show system alert even in foreground
    shouldPlaySound: true,   // Play sound
    shouldSetBadge: true,    // Update badge count
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Create Android notification channel with custom sound ────────────────────
async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('furrever', {
    name: 'FurrEver Notifications',
    description: 'Adoption updates, messages and alerts from FurrEver',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F4A900',
    sound: 'notification_sound.wav', // Must exist in assets/ and referenced in app.json
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
}

// ─── Register push token and save to Firestore ────────────────────────────────
export async function registerPushToken(uid: string): Promise<string | null> {
  // Push only works on real physical devices
  if (!Device.isDevice) {
    console.warn('[Push] Skipped: not a real device (emulator/simulator)');
    return null;
  }

  try {
    // 1. Setup Android channel first
    await setupAndroidChannel();

    // 2. Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: false,
          allowCriticalAlerts: false,
          provideAppNotificationSettings: false,
          allowProvisional: false,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push] Permission denied by user');
      return null;
    }

    // 3. Get Expo push token (this is what Expo Push API uses)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'ad7b2d2d-6305-4234-83af-5f751746426c',
    });
    const token = tokenData.data;

    if (!token) {
      console.warn('[Push] Got empty token');
      return null;
    }

    // FIX: Safety net — verify Firestore user doc exists before updateDoc.
    // updateDoc throws "No document to update" if the doc doesn't exist yet.
    // This can happen if registerPushToken is called before the user doc
    // is created (e.g. during new account registration before verification).
    const userRef = doc(firestore, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.warn('[Push] User document does not exist yet — skipping token save. Will retry after email verification.');
      return null;
    }

    // 4. Save to Firestore (safe — doc confirmed to exist)
    await updateDoc(userRef, {
      expoPushToken: token,
      pushTokenUpdatedAt: new Date().toISOString(),
      platform: Platform.OS,
    });

    console.log('[Push] ✅ Token registered:', token);
    return token;
  } catch (error: any) {
    console.error('[Push] Registration failed:', error?.message || error);
    return null;
  }
}

// ─── Send push notification via Expo Push API (peer-to-peer from RN) ──────────
// Use for: chat messages, adoption requests — events triggered by another user
// For admin broadcasts: web API route calls Expo Push API server-side
export async function sendExpoPush(
  expoPushToken: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  if (!expoPushToken?.startsWith('ExponentPushToken')) {
    console.warn('[Push] Invalid token, skipping:', expoPushToken?.slice(0, 20));
    return;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        title,
        body,
        data,
        sound: {
          name: 'notification_sound.wav', // Custom sound
          critical: false,
          volume: 1.0,
        },
        priority: 'high',
        channelId: 'furrever', // Must match the channel created above
        badge: 1,
        ttl: 60, // Expire after 60 seconds if not delivered
      }),
    });

    const result = await response.json();

    if (result?.data?.status === 'error') {
      console.error('[Push] Expo Push API error:', result.data.message);
    } else {
      console.log('[Push] ✅ Sent successfully:', title);
    }
  } catch (error: any) {
    console.error('[Push] Send failed:', error?.message || error);
  }
}