// contexts/chatContext.tsx
// CHANGED: getOrCreateChatRoom and handleSend-equivalent now also push to recipient
// New exported helper: notifyNewMessage — call this from chatScreenModal after batch.commit()

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import {
  addDoc, collection, onSnapshot, query, serverTimestamp,
  where, doc, updateDoc, Timestamp, getDoc
} from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { useAuth } from "./AuthContext";
import { ChatRoomType, ChatContextType } from "@/types";
// ✅ NEW
import { sendExpoPush } from "@/services/pushTokenService";

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// ─── Exported helper: call this from chatScreenModal after sending a message ──
// Usage: await notifyNewMessage(otherUserId, senderName, messagePreview)
export async function notifyNewMessage(
  recipientUid: string,
  senderName: string,
  messagePreview: string
): Promise<void> {
  try {
    // 1. Write Firestore notification (in-app banner)
    await addDoc(collection(firestore, "notifications"), {
      receiverId: recipientUid,
      title: `💬 ${senderName}`,
      message: messagePreview.length > 80
        ? messagePreview.slice(0, 80) + '…'
        : messagePreview,
      type: 'chat',
      isRead: false,
      createdAt: Timestamp.now(),
    });

    // 2. Send Expo push (works when app is closed)
    const recipientSnap = await getDoc(doc(firestore, "users", recipientUid));
    if (recipientSnap.exists()) {
      const token = recipientSnap.data().expoPushToken;
      if (token) {
        await sendExpoPush(
          token,
          `💬 ${senderName}`,
          messagePreview.length > 80
            ? messagePreview.slice(0, 80) + '…'
            : messagePreview,
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

  // ─── Real-time room sync ─────────────────────────────────────────────────────
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

  // ─── Mark as read ────────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (roomId: string) => {
    if (!user?.uid) return;
    try {
      updateDoc(doc(firestore, "chatRooms", roomId), {
        [`lastRead.${user.uid}`]: serverTimestamp()
      });
    } catch { /* silent */ }
  }, [user?.uid]);

  // ─── Get or create chat room ─────────────────────────────────────────────────
  const getOrCreateChatRoom = async (
    targetUserId: string,
    targetName: string,
    targetImage: string
  ) => {
    if (!user?.uid || !targetUserId) return null;

    const existing = rooms.find(r => r.participants.includes(targetUserId));
    if (existing) return existing.id;

    try {
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
      console.error("[ChatContext]: Creation Error", error);
      return null;
    }
  };

  const value = useMemo(() => ({
    getOrCreateChatRoom,
    markAsRead,
    rooms,
    loadingRooms
  }), [rooms, loadingRooms, markAsRead]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
};