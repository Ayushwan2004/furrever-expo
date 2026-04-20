import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { firestore } from '@/config/firebase';

// ─── Foreground notification behaviour ────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Android channel ──────────────────────────────────────────────────────────
async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('furrever', {
    name: 'FurrEver Notifications',
    description: 'Adoption updates, messages and alerts from FurrEver',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F4A900',
    sound: 'notification_sound.wav',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
}

// ─── Silent error check helpers ───────────────────────────────────────────────
const isNetworkError = (error: any): boolean => {
  const msg: string = error?.message ?? '';
  return (
    msg.includes('Network request failed') ||
    msg.includes('network error') ||
    msg.includes('fetch')
  );
};

// ─── Register push token and save to Firestore ────────────────────────────────
export async function registerPushToken(uid: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  try {
    await setupAndroidChannel();

    // Request permissions
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

    if (finalStatus !== 'granted') return null;

    // Get Expo push token — use the CORRECT new project ID
    let token: string;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'bb8dd4db-746e-4cd1-a768-364842bf4fcb', 
      });
      token = tokenData.data;
    } catch (tokenError: any) {
      // Silently swallow network errors (offline, Expo servers unreachable)
      if (isNetworkError(tokenError)) return null;
      throw tokenError; // re-throw unexpected errors
    }

    if (!token) return null;

    // Verify Firestore user doc exists before writing
    const userRef = doc(firestore, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;

    // Skip update if the token hasn't changed — avoids redundant Firestore writes
    const existingToken = userSnap.data()?.expoPushToken;
    if (existingToken === token) return token;

    await updateDoc(userRef, {
      expoPushToken: token,
      pushTokenUpdatedAt: new Date().toISOString(),
      platform: Platform.OS,
    });

    return token;
  } catch (error: any) {
    // Suppress network / offline errors silently
    if (!isNetworkError(error)) {
      console.warn('[Push] Registration failed:', error?.message || error);
    }
    return null;
  }
}

// ─── Send push notification via Expo Push API ─────────────────────────────────
export async function sendExpoPush(
  expoPushToken: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  if (!expoPushToken?.startsWith('ExponentPushToken')) return;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        title,
        body,
        data,
        sound: {
          name: 'notification_sound.wav',
          critical: false,
          volume: 1.0,
        },
        priority: 'high',
        channelId: 'furrever',
        badge: 1,
        ttl: 60,
      }),
    });
    const result = await response.json();
    if (result?.data?.status === 'error') {
      console.warn('[Push] Expo Push API error:', result.data.message);
    }
  } catch (error: any) {
    // Suppress network errors silently
    if (!isNetworkError(error)) {
      console.warn('[Push] Send failed:', error?.message || error);
    }
  }
}