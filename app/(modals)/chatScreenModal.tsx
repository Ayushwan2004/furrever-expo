// app/(modals)/chatScreenModal.tsx
// CHANGED: handleSend now calls notifyNewMessage after committing the batch
// Only the handleSend function is modified — all other code is identical

import React, { useEffect, useRef, useState, memo, useMemo, useCallback } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, StyleSheet,
  TextInput, TouchableOpacity, View, ActivityIndicator, Alert, Linking, Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc, collection, doc, onSnapshot, orderBy,
  query, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import {
  PaperPlaneRight, Image as ImageIcon,
  MapPin, Camera, FilePlus, X, MagnifyingGlassPlus
} from 'phosphor-react-native';

import ScreenWrapper from '@/components/ScreenWrapper';
import Typo from '@/components/Typo';
import BackButton from '@/components/BackButton';
import { firestore } from '@/config/firebase';
import { colors, spacingX } from '@/constants/themes';
import { useAuth } from '@/contexts/AuthContext';
import { useChat, notifyNewMessage } from '@/contexts/chatContext'; // ✅ import notifyNewMessage
import { uploadFileToCloudinary } from '@/services/imageService';
import { UserType, MessageType } from '@/types';

const ChatScreenModal = () => {
  useKeepAwake();
  const { roomId, otherUserId, otherUserName } = useLocalSearchParams<{
    roomId: string; otherUserId: string; otherUserName: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputText, setInputText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [otherUser, setOtherUser] = useState<UserType | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const busyLock = useRef(false);
  const isMounted = useRef(true);
  const navigationLock = useRef(false);
  const lastLocationSent = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!otherUserId) return;
    return onSnapshot(doc(firestore, "users", otherUserId), (snap) => {
      if (snap.exists() && isMounted.current) setOtherUser(snap.data() as UserType);
    });
  }, [otherUserId]);

  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(firestore, `chatRooms/${roomId}/messages`),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      if (isMounted.current) {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as MessageType)));
      }
    });
  }, [roomId]);

  // ✅ CHANGED: handleSend now also pushes notification to the other user
  const handleSend = async (type: 'text' | 'image' | 'location', content: any) => {
    if (busyLock.current || !roomId || !user?.uid) return;
    if (type === 'text' && !inputText.trim()) return;

    busyLock.current = true;
    const messageContent = type === 'text' ? inputText.trim() : content;
    const batch = writeBatch(firestore);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const msgRef = doc(collection(firestore, `chatRooms/${roomId}/messages`));
      batch.set(msgRef, {
        senderId: user.uid,
        type,
        content: messageContent,
        createdAt: serverTimestamp(),
      });

      const lastMessageText =
        type === 'text' ? messageContent :
        type === 'image' ? '📷 Photo' :
        '📍 Location';

      const roomRef = doc(firestore, "chatRooms", roomId);
      batch.update(roomRef, {
        lastMessage: lastMessageText,
        updatedAt: serverTimestamp(),
        [`lastRead.${user.uid}`]: serverTimestamp()
      });

      await batch.commit();

      if (type === 'location') lastLocationSent.current = Date.now();

      // ✅ Push notification to recipient (fire and forget — don't block UI)
      if (otherUserId && user.name) {
        notifyNewMessage(otherUserId, user.name, lastMessageText).catch(console.error);
      }

      if (isMounted.current) {
        setInputText("");
        setShowMenu(false);
      }
    } catch (error) {
      console.error("Send Error:", error);
    } finally {
      setTimeout(() => { busyLock.current = false; }, 500);
    }
  };

  const handleLocation = async () => {
    if (busyLock.current || locationLoading) return;

    const now = Date.now();
    if (now - lastLocationSent.current < 10000) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Easy there! ✋", "Please wait a few seconds before sharing location again.");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLocationLoading(true);
      busyLock.current = true;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Needed 📍", "Location access is required.");
        return;
      }

      const locationPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("FriendlyTimeout")), 8000)
      );

      const loc: any = await Promise.race([locationPromise, timeoutPromise]);

      if (loc?.coords) {
        busyLock.current = false;
        await handleSend('location', { lat: loc.coords.latitude, lng: loc.coords.longitude });
        if (isMounted.current) setShowMenu(false);
      }
    } catch (error: any) {
      if (error.message !== "FriendlyTimeout") console.error("Location Hardware Error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Pinpointing failed 🛰️", "Try moving closer to a window or checking GPS settings.");
    } finally {
      if (isMounted.current) {
        setLocationLoading(false);
        setTimeout(() => { busyLock.current = false; }, 500);
      }
    }
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Error", "Camera access denied");
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (!result.canceled) uploadAndSend(result.assets[0]);
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) uploadAndSend(result.assets[0]);
  };

  const uploadAndSend = async (asset: any) => {
    setUploading(true);
    const res = await uploadFileToCloudinary(asset, 'chat');
    if (res.success) await handleSend('image', res.data);
    if (isMounted.current) setUploading(false);
  };

  const handleProfilePress = useCallback(() => {
    if (navigationLock.current || !otherUserId) return;
    navigationLock.current = true;
    Haptics.selectionAsync();
    router.push({ pathname: "/(modals)/userAnalyticsModal", params: { userId: otherUserId } });
    setTimeout(() => { navigationLock.current = false; }, 1000);
  }, [otherUserId]);

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <TouchableOpacity style={styles.headerInfo} onPress={handleProfilePress} activeOpacity={0.7}>
          <Image
            source={otherUser?.image ? { uri: otherUser.image } : require('../../assets/Avatar.jpg')}
            style={styles.headerAvatar} contentFit="cover"
          />
          <View>
            <Typo fontWeight="700" size={17}>{otherUser?.name || otherUserName || "..."}</Typo>
            <Typo size={12} color={colors.primary} fontWeight="700">View Profile</Typo>
          </View>
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.chatArea}>
          <FlatList
            data={messages}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <MessageBubble
                item={item}
                isMine={item.senderId === user?.uid}
                onImagePress={(uri: string) => setPreviewImage(uri)}
              />
            )}
          />
        </View>

        <View style={styles.inputSection}>
          {showMenu && (
            <View style={styles.richMenu}>
              <MenuBtn
                icon={uploading ? <ActivityIndicator size="small" color={colors.primary} /> : <ImageIcon color={colors.primary} />}
                label="Gallery" onPress={openGallery}
              />
              <MenuBtn icon={<Camera color={colors.primary} />} label="Camera" onPress={openCamera} />
              <MenuBtn
                icon={locationLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <MapPin color={colors.primary} />}
                label={locationLoading ? "Locating..." : "Location"} onPress={handleLocation}
              />
            </View>
          )}
          <View style={styles.inputBar}>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowMenu(!showMenu); }}>
              {showMenu ? <X size={28} color={colors.primary} weight="bold" /> : <FilePlus size={28} color={colors.primary} weight="duotone" />}
            </TouchableOpacity>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type message..."
              style={styles.input}
              multiline
              placeholderTextColor={colors.textLighter}
            />
            <TouchableOpacity
              disabled={!inputText.trim() || uploading || busyLock.current}
              onPress={() => handleSend('text', inputText)}
              style={[styles.sendBtn, {
                backgroundColor: (!inputText.trim() || busyLock.current)
                  ? colors.primary + '40' : colors.primary
              }]}
            >
              {uploading
                ? <ActivityIndicator color="white" size="small" />
                : <PaperPlaneRight color="white" weight="fill" size={20} />
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!previewImage} transparent={false} animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.fullScreenPreview}>
          <TouchableOpacity style={styles.closePreview} onPress={() => setPreviewImage(null)}>
            <X size={30} color="white" weight="bold" />
          </TouchableOpacity>
          <Image source={{ uri: previewImage || '' }} style={styles.previewImage} contentFit="contain" />
        </View>
      </Modal>
    </ScreenWrapper>
  );
};

const MessageBubble = memo(({ item, isMine, onImagePress }: any) => {
  const openMap = () => {
    if (item.type === 'location' && item.content?.lat) {
      const { lat, lng } = item.content;
      Linking.openURL(Platform.select({
        ios: `maps:0,0?q=${lat},${lng}`,
        android: `geo:0,0?q=${lat},${lng}`
      })!);
    }
  };
  return (
    <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
      {item.type === 'text' && <Typo color={isMine ? "white" : colors.text} size={15}>{item.content || ""}</Typo>}
      {item.type === 'image' && (
        <TouchableOpacity onPress={() => onImagePress(item.content)} activeOpacity={0.9}>
          <Image source={{ uri: item.content }} style={styles.msgImg} transition={200} />
          <View style={styles.zoomIcon}><MagnifyingGlassPlus size={18} color="white" /></View>
        </TouchableOpacity>
      )}
      {item.type === 'location' && (
        <TouchableOpacity style={styles.locationBtn} onPress={openMap}>
          <MapPin size={22} color={isMine ? "white" : colors.primary} weight="fill" />
          <View>
            <Typo color={isMine ? "white" : colors.text} fontWeight="700">Location Shared</Typo>
            <Typo color={isMine ? "rgba(255,255,255,0.7)" : colors.textLighter} size={11}>Tap for Maps</Typo>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
});

const MenuBtn = ({ icon, label, onPress }: any) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuIcon}>{icon}</View>
    <Typo size={12} fontWeight="600">{label}</Typo>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.backgroundDark, backgroundColor: colors.background },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'flex-start', paddingLeft: 15 },
  headerAvatar: { width: 40, height: 40, borderRadius: 200, backgroundColor: colors.backgroundDark },
  chatArea: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 10 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 20, marginBottom: 12 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: 'white', borderBottomLeftRadius: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  msgImg: { width: 220, height: 160, borderRadius: 15 },
  zoomIcon: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: 4 },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputSection: { backgroundColor: colors.background },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: colors.background, gap: 12, borderTopWidth: 1, borderTopColor: colors.backgroundDark, paddingBottom: Platform.OS === 'ios' ? 30 : 12 },
  input: { flex: 1, backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100, fontSize: 15, color: colors.text },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  richMenu: { flexDirection: 'row', padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.backgroundDark, justifyContent: 'space-around' },
  menuItem: { alignItems: 'center', gap: 8 },
  menuIcon: { width: 50, height: 50, backgroundColor: 'white', borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  fullScreenPreview: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  previewImage: { width: '100%', height: '100%' },
  closePreview: { position: 'absolute', top: 50, right: 20, zIndex: 10 }
});

export default React.memo(ChatScreenModal);