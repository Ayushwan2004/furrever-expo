import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import {
  addDoc, collection, onSnapshot, query, serverTimestamp,
  where, doc, updateDoc, Timestamp, getDoc, getDocs, deleteDoc
} from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { useAuth } from "./AuthContext";
import { ChatRoomType, ChatContextType } from "@/types";
import { sendExpoPush } from "@/services/pushTokenService";

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// ─── Exported helper ──────────────────────────────────────────────────────────
export async function notifyNewMessage(
  recipientUid: string,
  senderName: string,
  messagePreview: string
): Promise<void> {
  try {
    await addDoc(collection(firestore, "notifications"), {
      receiverId: recipientUid,
      title: `💬 ${senderName}`,
      message: messagePreview.length > 80 ? messagePreview.slice(0, 80) + '…' : messagePreview,
      type: 'chat',
      isRead: false,
      createdAt: Timestamp.now(),
    });

    const recipientSnap = await getDoc(doc(firestore, "users", recipientUid));
    if (recipientSnap.exists()) {
      const token = recipientSnap.data().expoPushToken;
      if (token) {
        await sendExpoPush(
          token,
          `💬 ${senderName}`,
          messagePreview.length > 80 ? messagePreview.slice(0, 80) + '…' : messagePreview,
          { type: 'chat', senderId: recipientUid }
        );
      }
    }
  } catch (error) {
    console.error('[Chat] Notification error:', error);
  }
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoomType[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // ─── Real-time room sync ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) { setRooms([]); setLoadingRooms(false); return; }

    const q = query(
      collection(firestore, "chatRooms"),
      where("participants", "array-contains", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const myRooms = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as ChatRoomType;
      });
      setRooms(myRooms.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
      setLoadingRooms(false);
    }, (error) => {
      console.error("[ChatContext]: Sync Error", error);
      setLoadingRooms(false);
    });

    return unsub;
  }, [user?.uid]);

  // ─── Mark as read ─────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (roomId: string) => {
    if (!user?.uid) return;
    try {
      updateDoc(doc(firestore, "chatRooms", roomId), {
        [`lastRead.${user.uid}`]: serverTimestamp()
      });
    } catch { /* silent */ }
  }, [user?.uid]);

  // ─── Get or create chat room ──────────────────────────────────────────────
  // FIX: Query Firestore directly instead of relying on local `rooms` state.
  // Local state may not be synced yet when the user taps the chat icon for the
  // first time, causing duplicate rooms to be created on rapid successive taps.
  const getOrCreateChatRoom = useCallback(async (
    targetUserId: string,
    targetName: string,
    targetImage: string
  ): Promise<string | null> => {
    if (!user?.uid || !targetUserId) return null;

    try {
      // 1. Check local state first (fast path — avoids a network round-trip
      //    if rooms are already loaded).
      const localMatch = rooms.find(r => r.participants.includes(targetUserId));
      if (localMatch) return localMatch.id;

      // 2. Query Firestore directly to guard against race conditions where
      //    local state hasn't populated yet (e.g. first open, or slow sync).
      const q = query(
        collection(firestore, "chatRooms"),
        where("participants", "array-contains", user.uid)
      );
      const snapshot = await getDocs(q);
      const existing = snapshot.docs.find(d =>
        (d.data().participants as string[]).includes(targetUserId)
      );
      if (existing) return existing.id;

      // 3. No room found anywhere — create one.
      const res = await addDoc(collection(firestore, "chatRooms"), {
        participants: [user.uid, targetUserId],
        participantMetadata: {
          [user.uid]: { name: user.name || "User", image: user.image || "" },
          [targetUserId]: { name: targetName || "Pet Owner", image: targetImage || "" }
        },
        lastMessage: "Started a conversation",
        updatedAt: serverTimestamp(),
        lastRead: {
          [user.uid]: serverTimestamp(),
          [targetUserId]: Timestamp.fromDate(new Date(0))
        }
      });
      return res.id;
    } catch (error) {
      console.error("[ChatContext]: getOrCreateChatRoom Error", error);
      return null;
    }
  }, [user?.uid, user?.name, user?.image, rooms]);

  // ─── Delete chat room ─────────────────────────────────────────────────────
  const deleteRoom = useCallback(async (roomId: string): Promise<void> => {
    try {
      await deleteDoc(doc(firestore, "chatRooms", roomId));
    } catch (error) {
      console.error("[ChatContext]: deleteRoom Error", error);
    }
  }, []);

  const value = useMemo(() => ({
    getOrCreateChatRoom,
    markAsRead,
    deleteRoom,
    rooms,
    loadingRooms,
  }), [rooms, loadingRooms, markAsRead, getOrCreateChatRoom, deleteRoom]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
};