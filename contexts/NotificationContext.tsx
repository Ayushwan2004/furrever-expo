import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import {
  collection, query, where, onSnapshot,
  orderBy, limit, doc, updateDoc,
} from 'firebase/firestore';
import { firestore } from '@/config/firebase';
import { useAuth } from './AuthContext';

type NotificationContextType = {
  showLocalNotification: (title: string, message: string) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const shownIds = useRef<Set<string>>(new Set());

  // ─── Trigger a real device notification (system tray) ────────────────────────
  const triggerDeviceNotification = useCallback(async (
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
          // Android channel
          ...(Platform.OS === 'android' ? { channelId: 'furrever' } : {}),
        },
        trigger: null, // null = show immediately
      });
    } catch (error) {
      console.error('[Notif] scheduleNotificationAsync failed:', error);
    }
  }, []);

  // ─── Firestore listener: user-specific notifications ─────────────────────────
  useEffect(() => {
    if (!user?.uid) return;

    const handleDocs = (docs: any[], isBroadcast: boolean) => {
      docs.forEach((docData) => {
        const data = docData.data();
        const id = docData.id;

        // Skip if already shown this session
        if (shownIds.current.has(id)) return;

        // Skip if older than 5 minutes (prevents old notifications replaying on login)
        const createdAt = data.createdAt?.toDate?.();
        if (createdAt && Date.now() - createdAt.getTime() > 5 * 60 * 1000) {
          // Still mark as read so it doesn't keep appearing
          if (!isBroadcast) {
            updateDoc(doc(firestore, 'notifications', id), { isRead: true }).catch(() => {});
          }
          return;
        }

        shownIds.current.add(id);

        // Show real device notification
        triggerDeviceNotification(data.title, data.message, {
          type: data.type || 'general',
          notifId: id,
        });

        // Mark targeted notifications as read
        if (!isBroadcast) {
          updateDoc(doc(firestore, 'notifications', id), { isRead: true }).catch(() => {});
        }
      });
    };

    // Listener 1: this user's notifications
    const unsubUser = onSnapshot(
      query(
        collection(firestore, 'notifications'),
        where('receiverId', '==', user.uid),
        where('isRead', '==', false),
        orderBy('createdAt', 'desc'),
        limit(5),
      ),
      (snap) => {
        console.log('[Notif] User snap:', snap.docs.length, 'docs');
        handleDocs(snap.docs, false);
      },
      (error) => console.error('[Notif] User listener error:', error)
    );

    // Listener 2: broadcast notifications (ALL)
    const unsubAll = onSnapshot(
      query(
        collection(firestore, 'notifications'),
        where('receiverId', '==', 'ALL'),
        where('isRead', '==', false),
        orderBy('createdAt', 'desc'),
        limit(3),
      ),
      (snap) => {
        console.log('[Notif] ALL snap:', snap.docs.length, 'docs');
        handleDocs(snap.docs, true);
      },
      (error) => console.error('[Notif] ALL listener error:', error)
    );

    return () => { unsubUser(); unsubAll(); };
  }, [user?.uid, triggerDeviceNotification]);

  // ─── Handle notification tap (from system tray) ───────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      console.log('[Push] Notification tapped:', data);
      // Add navigation here if needed based on data.type
      // e.g. if (data.type === 'chat') router.push(...)
    });
    return () => sub.remove();
  }, []);

  const showLocalNotification = useCallback((title: string, message: string) => {
    triggerDeviceNotification(title, message, { type: 'local' });
  }, [triggerDeviceNotification]);

  return (
    <NotificationContext.Provider value={{ showLocalNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};

// Need Platform for Android channel
import { Platform } from 'react-native';