import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { firestore } from "@/config/firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function setupAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("furrever", {
    name: "FurrEver Notifications",
    description: "Adoption updates, messages and alerts from FurrEver",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#F4A900",
    sound: "notifications.wav",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
}

export async function registerPushToken(uid: string): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    await setupAndroidChannel();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({
      projectId: "b0a519bf-7c57-4df8-bb0d-c5e6fef3e107",
    });
    const { data: fcmToken } = await Notifications.getDevicePushTokenAsync();

    const userRef = doc(firestore, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;

    await updateDoc(userRef, {
      expoPushToken,
      fcmToken,
      pushTokenUpdatedAt: new Date().toISOString(),
      platform: Platform.OS,
    });
    return expoPushToken;
  } catch (error: any) {
    console.warn("[Push] Registration failed:", error?.message || error);
    return null;
  }
}

export async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  if (!token?.startsWith("ExponentPushToken")) return;
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data,
        sound: "notifications.wav",
        priority: "high",
        channelId: "furrever",
        badge: 1,
      }),
    });
    const result = await response.json();
    if (result?.data?.status === "error") {
      console.warn("[Push] Send error:", result.data.message);
    }
  } catch (error: any) {
    console.warn("[Push] Send failed:", error?.message);
  }
}