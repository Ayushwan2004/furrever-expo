// contexts/NotificationContext.tsx
import React, {
  createContext, useContext, useEffect,
  useRef, useCallback, useState,
} from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection, query, where, onSnapshot,
  orderBy, limit, doc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { firestore } from '@/config/firebase';
import { useAuth } from './AuthContext';

const SHOWN_IDS_KEY = '@furrever_shown_notif_ids';
const SHOWN_IDS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type ShownEntry = { ts: number };
type ShownMap = Record<string, ShownEntry>;

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
  data?: Record<string, any>;
};

type NotificationContextType = {
  notifications: AppNotification[];
  unreadCount: number;
  showLocalNotification: (title: string, message: string) => void;
  markAllRead: () => Promise<void>;
  markOneRead: (id: string) => Promise<void>;
  clearAll: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const shownMap = useRef<ShownMap>({});
  const shownMapLoaded = useRef(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    AsyncStorage.getItem(SHOWN_IDS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed: ShownMap = JSON.parse(raw);
        const now = Date.now();
        const pruned: ShownMap = {};
        for (const [id, entry] of Object.entries(parsed)) {
          if (now - entry.ts < SHOWN_IDS_TTL_MS) pruned[id] = entry;
        }
        shownMap.current = pruned;
      } catch { }
    }).finally(() => { shownMapLoaded.current = true; });
  }, []);

  const persistShownMap = useCallback(() => {
    AsyncStorage.setItem(SHOWN_IDS_KEY, JSON.stringify(shownMap.current)).catch(() => { });
  }, []);

  const hasBeenShown = useCallback((id: string) => !!shownMap.current[id], []);
  const markShown = useCallback((id: string) => {
    shownMap.current[id] = { ts: Date.now() };
    persistShownMap();
  }, [persistShownMap]);

  const triggerDeviceNotification = useCallback(async (
    title: string, body: string, data: Record<string, any> = {}
  ) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title, body, data,
          sound: 'notification_sound.wav',
          badge: 1,
          ...(Platform.OS === 'android' ? { channelId: 'furrever' } : {}),
        },
        trigger: null,
      });
    } catch { }
  }, []);

  // ── Merge incoming Firestore docs into state ──────────────────────────────
  const mergeDocs = useCallback((docs: any[], isBroadcast: boolean) => {
    if (!shownMapLoaded.current) return;
    const now = Date.now();

    const incoming: AppNotification[] = docs.map(docSnap => {
      const d = docSnap.data();
      const createdAt = d.createdAt?.toDate?.() ?? new Date();
      return {
        id: docSnap.id,
        title: d.title,
        message: d.message,
        type: d.type || 'general',
        isRead: d.isRead ?? false,
        createdAt,
        data: d.data,
      };
    });

    setNotifications(prev => {
      const map = new Map(prev.map(n => [n.id, n]));
      incoming.forEach(n => map.set(n.id, n));
      return Array.from(map.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    });

    // Trigger device notifications for fresh unread ones
    incoming.forEach(n => {
      if (hasBeenShown(n.id)) return;
      if (now - n.createdAt.getTime() > MAX_AGE_MS) {
        markShown(n.id);
        return;
      }
      markShown(n.id);
      triggerDeviceNotification(n.title, n.message, { type: n.type, notifId: n.id });
      if (!isBroadcast) {
        updateDoc(doc(firestore, 'notifications', n.id), { isRead: true }).catch(() => { });
      }
    });
  }, [hasBeenShown, markShown, triggerDeviceNotification]);

  // ── Firestore listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;

    const unsubUser = onSnapshot(
      query(
        collection(firestore, 'notifications'),
        where('receiverId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      ),
      snap => mergeDocs(snap.docs, false),
      () => { }
    );

    const unsubAll = onSnapshot(
      query(
        collection(firestore, 'notifications'),
        where('receiverId', '==', 'ALL'),
        orderBy('createdAt', 'desc'),
        limit(10)
      ),
      snap => mergeDocs(snap.docs, true),
      () => { }
    );

    return () => { unsubUser(); unsubAll(); };
  }, [user?.uid, mergeDocs]);

  // ── Mark all read ─────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.isRead && n.data?.receiverId !== 'ALL');
    if (!unread.length) return;
    const batch = writeBatch(firestore);
    unread.forEach(n => batch.update(doc(firestore, 'notifications', n.id), { isRead: true }));
    await batch.commit();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, [notifications]);

  // ── Mark one read ─────────────────────────────────────────────────────────
  const markOneRead = useCallback(async (id: string) => {
    await updateDoc(doc(firestore, 'notifications', id), { isRead: true }).catch(() => { });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const showLocalNotification = useCallback((title: string, message: string) => {
    triggerDeviceNotification(title, message, { type: 'local' });
  }, [triggerDeviceNotification]);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount,
      showLocalNotification, markAllRead, markOneRead, clearAll,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
};