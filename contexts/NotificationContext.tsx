// contexts/NotificationContext.tsx
import React, {
  createContext, useContext, useEffect,
  useState, useRef, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform, Dimensions,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  collection, query, where, onSnapshot,
  orderBy, limit, doc, updateDoc,
} from 'firebase/firestore';
import { firestore } from '@/config/firebase';
import { useAuth } from './AuthContext';
import { colors, radius } from '@/constants/themes';
import { scale, verticalScale } from '@/utils/styling';

const { width } = Dimensions.get('window');

// Show sound + badge but NOT the system banner — we use our own
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

const PET_ICONS = ['🐶', '🐱', '🐾', '🦮', '🐈', '🐕'];

type NotifData = { id: string; title: string; message: string };
type NotificationContextType = { showLocalNotification: (title: string, message: string) => void };

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [queue, setQueue] = useState<NotifData[]>([]);
  const [activeNotif, setActiveNotif] = useState<NotifData | null>(null);
  const [currentIcon, setCurrentIcon] = useState('🐾');
  const slideAnim = useRef(new Animated.Value(-verticalScale(120))).current;
  const shownIds = useRef<Set<string>>(new Set());
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimating = useRef(false);
  const iconIndex = useRef(0);

  // Process queue one at a time
  useEffect(() => {
    if (queue.length > 0 && !activeNotif && !isAnimating.current) {
      const [next, ...rest] = queue;
      setQueue(rest);
      showNotif(next);
    }
  }, [queue, activeNotif]);

  const enqueue = useCallback((notif: NotifData) => {
    if (shownIds.current.has(notif.id)) return;
    shownIds.current.add(notif.id);
    setQueue(prev => [...prev, notif]);
  }, []);

  // ─── Two separate Firestore listeners instead of or() ─────────────────────
  // Firestore SDK typing doesn't allow mixing or() with additional where() clauses
  useEffect(() => {
    if (!user?.uid) return;

    const handleSnap = (snap: any, isBroadcast: boolean) => {
      snap.docs.forEach((docData: any) => {
        const data = docData.data();
        // Skip notifications older than 60s (prevents replaying on login)
        const createdAt = data.createdAt?.toDate?.();
        if (createdAt && Date.now() - createdAt.getTime() > 60_000) return;

        enqueue({ id: docData.id, title: data.title, message: data.message });

        // Only mark targeted notifications as read — not broadcasts
        if (!isBroadcast) {
          updateDoc(doc(firestore, 'notifications', docData.id), { isRead: true }).catch(() => {});
        }
      });
    };

    // Listener 1: notifications targeted at this specific user
    const unsubUser = onSnapshot(
      query(
        collection(firestore, 'notifications'),
        where('receiverId', '==', user.uid),
        where('isRead', '==', false),
        orderBy('createdAt', 'desc'),
        limit(5),
      ),
      (snap) => handleSnap(snap, false),
    );

    // Listener 2: broadcast notifications (ALL users)
    const unsubAll = onSnapshot(
      query(
        collection(firestore, 'notifications'),
        where('receiverId', '==', 'ALL'),
        where('isRead', '==', false),
        orderBy('createdAt', 'desc'),
        limit(3),
      ),
      (snap) => handleSnap(snap, true),
    );

    return () => { unsubUser(); unsubAll(); };
  }, [user?.uid, enqueue]);

  // ─── Expo push listeners ──────────────────────────────────────────────────
  useEffect(() => {
    // Foreground push received — show our custom banner
    const subFg = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      if (title) {
        enqueue({ id: notification.request.identifier, title, message: body || '' });
      }
    });

    // User tapped notification from background/killed state
    const subTap = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      console.log('[Push] Tapped:', data);
      // Add router navigation here based on data.type if needed
    });

    return () => { subFg.remove(); subTap.remove(); };
  }, []);

  // ─── Banner animation ─────────────────────────────────────────────────────
  const showNotif = (notif: NotifData) => {
    isAnimating.current = true;
    setCurrentIcon(PET_ICONS[iconIndex.current % PET_ICONS.length]);
    iconIndex.current++;
    setActiveNotif(notif);

    slideAnim.setValue(-verticalScale(120));
    Animated.spring(slideAnim, {
      toValue: Platform.OS === 'ios' ? verticalScale(52) : verticalScale(32),
      useNativeDriver: true,
      tension: 45,
      friction: 9,
    }).start(() => { isAnimating.current = false; });

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => dismiss(), 4500);
  };

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.timing(slideAnim, {
      toValue: -verticalScale(120),
      duration: 280,
      useNativeDriver: true,
    }).start(() => setActiveNotif(null));
  }, []);

  const showLocalNotification = useCallback((title: string, message: string) => {
    enqueue({ id: `local-${Date.now()}`, title, message });
  }, [enqueue]);

  return (
    <NotificationContext.Provider value={{ showLocalNotification }}>
      {children}

      {activeNotif && (
        <Animated.View
          style={[styles.overlay, { transform: [{ translateY: slideAnim }] }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity style={styles.card} onPress={dismiss} activeOpacity={0.92}>
            <View style={styles.accentBar} />
            <View style={styles.iconWrap}>
              <Text style={styles.iconEmoji}>{currentIcon}</Text>
            </View>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={styles.appLabel}>FurrEver</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.nowText}>now</Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>{activeNotif.title}</Text>
              <Text style={styles.message} numberOfLines={2}>{activeNotif.message}</Text>
            </View>
            <View style={styles.dismissWrap}>
              <View style={styles.dismissDot} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};

const CARD_WIDTH = width * 0.93;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 9999, alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.white,
    borderRadius: radius._20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingRight: scale(14),
    overflow: 'hidden',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 14,
    borderWidth: 1,
    borderColor: colors.backgroundDark,
  },
  accentBar: {
    width: scale(5),
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    marginRight: scale(10),
  },
  iconWrap: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(13),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(10),
    borderWidth: 1.5,
    borderColor: colors.primary + '30',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: scale(22) },
  content: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginBottom: verticalScale(2),
  },
  appLabel: {
    fontSize: scale(10),
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dot: { fontSize: scale(10), color: colors.textLighter },
  nowText: { fontSize: scale(10), color: colors.textLighter, fontWeight: '600' },
  title: {
    fontSize: scale(14),
    fontWeight: '800',
    color: colors.text,
    marginBottom: verticalScale(1),
    letterSpacing: -0.2,
  },
  message: {
    fontSize: scale(12),
    color: colors.textLighter,
    lineHeight: scale(17),
    fontWeight: '500',
  },
  dismissWrap: { paddingLeft: scale(6), alignItems: 'center', justifyContent: 'center' },
  dismissDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: colors.primary,
    opacity: 0.5,
  },
});