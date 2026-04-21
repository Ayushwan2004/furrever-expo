// components/NotificationBell.tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, FlatList, Pressable, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotification, AppNotification } from '@/contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

const ICON_MAP: Record<string, string> = {
  adoption:     '🐾',
  message:      '💬',
  certification:'📋',
  promo:        '🎉',
  general:      '🔔',
  local:        '📣',
};

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotification();
  const [visible, setVisible] = useState(false);

  const handleOpen = () => setVisible(true);
  const handleClose = () => setVisible(false);
  const handleMarkAll = async () => { await markAllRead(); };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <Pressable
      style={[styles.item, !item.isRead && styles.itemUnread]}
      onPress={() => markOneRead(item.id)}
    >
      <Text style={styles.itemIcon}>{ICON_MAP[item.type] ?? '🔔'}</Text>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.itemMsg} numberOfLines={2}>{item.message}</Text>
        <Text style={styles.itemTime}>
          {formatDistanceToNow(item.createdAt, { addSuffix: true })}
        </Text>
      </View>
      {!item.isRead && <View style={styles.dot} />}
    </Pressable>
  );

  return (
    <>
      {/* Bell Icon */}
      <TouchableOpacity onPress={handleOpen} style={styles.bell}>
        <Ionicons name="notifications-outline" size={26} color="#333" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Notification Drawer */}
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <SafeAreaView style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAll} style={styles.markAllBtn}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bell: { padding: 8, position: 'relative' },
  badge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  modal: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  markAllBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  markAllText: { fontSize: 13, color: '#F4A900', fontWeight: '600' },

  list: { paddingVertical: 8 },
  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
    gap: 12,
  },
  itemUnread: { backgroundColor: '#FFFBF0' },
  itemIcon: { fontSize: 24, marginTop: 2 },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  itemMsg: { fontSize: 13, color: '#555', lineHeight: 18 },
  itemTime: { fontSize: 11, color: '#aaa', marginTop: 4 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#F4A900', marginTop: 6,
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: '#aaa' },
});