// contexts/NotificationContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { firestore } from '@/config/firebase';
import { useAuth } from './AuthContext';

// ─── How long to remember a shown notification ID (7 days) ────────────────────
const SHOWN_IDS_KEY = '@furrever_shown_notif_ids';
const SHOWN_IDS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Notification age limit: ignore anything older than 5 minutes ─────────────
const MAX_AGE_MS = 5 * 60 * 1000;

type ShownEntry = { ts: number };
type ShownMap = Record<string, ShownEntry>;

type NotificationContextType = {
  showLocalNotification: (title: string, message: string) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();

  const shownMap = useRef<ShownMap>({});
  const shownMapLoaded = useRef(false);

  // ── Load persisted shown IDs from AsyncStorage once ──────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(SHOWN_IDS_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed: ShownMap = JSON.parse(raw);
          const now = Date.now();
          // Prune expired entries to keep storage small
          const pruned: ShownMap = {};
          for (const [id, entry] of Object.entries(parsed)) {
            if (now - entry.ts < SHOWN_IDS_TTL_MS) pruned[id] = entry;
          }
          shownMap.current = pruned;
        } catch {
          // corrupted storage — start fresh
        }
      })
      .catch(() => { })
      .finally(() => {
        shownMapLoaded.current = true;
      });
  }, []);

  // ── Persist shownMap to AsyncStorage ─────────────────────────────────────────
  const persistShownMap = useCallback(() => {
    AsyncStorage.setItem(SHOWN_IDS_KEY, JSON.stringify(shownMap.current)).catch(
      () => { }
    );
  }, []);

  // ── Check if a notification ID has already been shown ────────────────────────
  const hasBeenShown = useCallback((id: string): boolean => {
    return !!shownMap.current[id];
  }, []);

  // ── Mark a notification ID as shown ──────────────────────────────────────────
  const markShown = useCallback(
    (id: string) => {
      shownMap.current[id] = { ts: Date.now() };
      persistShownMap();
    },
    [persistShownMap]
  );

  // ── Trigger a real device notification ───────────────────────────────────────
  const triggerDeviceNotification = useCallback(
    async (
      title: string,
      body: string,
      data: Record<string, any> = {}
    ) => {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data,
            sound: 'notification_sound.wav',
            badge: 1,
            ...(Platform.OS === 'android' ? { channelId: 'furrever' } : {}),
          },
          trigger: null, // show immediately
        });
      } catch {
        // silent — notification failure should never crash the app
      }
    },
    []
  );

  // ── Process incoming Firestore notification docs ──────────────────────────────
  const handleDocs = useCallback(
    (docs: any[], isBroadcast: boolean) => {
      // Wait until AsyncStorage has loaded before processing
      // so we don't re-show notifications the user already saw
      if (!shownMapLoaded.current) return;

      const now = Date.now();

      docs.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;

        // Skip if already shown (persisted across sessions)
        if (hasBeenShown(id)) return;

        // Skip notifications older than MAX_AGE_MS — these are "stale"
        // notifications that would otherwise replay every time the user logs in
        const createdAt = data.createdAt?.toDate?.();
        if (createdAt && now - createdAt.getTime() > MAX_AGE_MS) {
          // Mark as read in Firestore so it stops appearing in the query
          if (!isBroadcast) {
            updateDoc(doc(firestore, 'notifications', id), {
              isRead: true,
            }).catch(() => { });
          }
          // Also mark locally so we never process it again this session
          markShown(id);
          return;
        }

        // Mark shown BEFORE triggering — prevents a race condition where
        // a Firestore snapshot fires twice before the first async write completes
        markShown(id);

        // Show real device notification
        triggerDeviceNotification(data.title, data.message, {
          type: data.type || 'general',
          notifId: id,
        });

        // Mark targeted notifications as read in Firestore
        if (!isBroadcast) {
          updateDoc(doc(firestore, 'notifications', id), {
            isRead: true,
          }).catch(() => { });
        }
      });
    },
    [hasBeenShown, markShown, triggerDeviceNotification]
  );

  // ── Firestore listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;

    // Listener 1: notifications targeted at this user
    const unsubUser = onSnapshot(
      query(
        collection(firestore, 'notifications'),
        where('receiverId', '==', user.uid),
        where('isRead', '==', false),
        orderBy('createdAt', 'desc'),
        limit(5)
      ),
      (snap) => handleDocs(snap.docs, false),
      () => { } // silent error — Firestore offline
    );

    // Listener 2: broadcast notifications (ALL users)
    const unsubAll = onSnapshot(
      query(
        collection(firestore, 'notifications'),
        where('receiverId', '==', 'ALL'),
        where('isRead', '==', false),
        orderBy('createdAt', 'desc'),
        limit(3)
      ),
      (snap) => handleDocs(snap.docs, true),
      () => { } // silent error — Firestore offline
    );

    return () => {
      unsubUser();
      unsubAll();
    };
  }, [user?.uid, handleDocs]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as any;
        // Add navigation here based on data.type if needed
        // e.g. if (data.type === 'chat') router.push(...)
      }
    );
    return () => sub.remove();
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────────
  const showLocalNotification = useCallback(
    (title: string, message: string) => {
      triggerDeviceNotification(title, message, { type: 'local' });
    },
    [triggerDeviceNotification]
  );

  return (
    <NotificationContext.Provider value={{ showLocalNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context)
    throw new Error('useNotification must be used within NotificationProvider');
  return context;
};