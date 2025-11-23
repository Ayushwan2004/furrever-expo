import { firestore } from "@/config/firebase";
import {collection, doc, getDoc,setDoc, addDoc,serverTimestamp, onSnapshot,query,orderBy } from "firebase/firestore";


export const getChatId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join("_");
};

export const createOrGetChat = async (myUid: string, otherUid: string) => {
  const chatId = getChatId(myUid, otherUid);
  const chatRef = doc(firestore, "chats", chatId);

  const snapshot = await getDoc(chatRef);

  if (!snapshot.exists()) {
    await setDoc(chatRef, {
      chatId,
      users: [myUid, otherUid],
      lastMessage: "",
      updatedAt: serverTimestamp(),
    });
  }

  return chatId;
};

export const sendMessage = async (chatId: string, senderUid: string, text: string) => {
  const messagesRef = collection(firestore, "chats", chatId, "messages");

  await addDoc(messagesRef, {
    senderUid,
    text,
    createdAt: serverTimestamp(),
  });
  await setDoc(
    doc(firestore, "chats", chatId),
    {
      lastMessage: text,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const listenToMessages = (chatId: string, callback: Function) => {
  const q = query(
    collection(firestore, "chats", chatId, "messages"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(msgs);
  });
};

export const getUserChats = (myUid: string, callback: Function) => {
  const q = query(
    collection(firestore, "chats"),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    let chats = snapshot.docs
      .map((doc) => ({ ...doc.data() }))
      .filter((chat) => chat.users.includes(myUid));

    callback(chats);
  });
};

