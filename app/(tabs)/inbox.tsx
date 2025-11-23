import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, FlatList } from "react-native";
import ScreenWrapper from "@/components/ScreenWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { getUserChats } from "@/services/chatService";
import { useRouter } from "expo-router";
import { router } from "expo-router";

const Inbox = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
  if (!user?.uid) return;

  const unsubscribe = getUserChats(user.uid, (data: any[]) => {
    setChats(data);
  });

  return () => unsubscribe();
}, [user]);

  const openChat = (otherUser: any) => {
    router.push({
      pathname: "/(tabs)/inbox",
      params: {
        uid: otherUser.uid,
        name: otherUser.name,
      },
    });
  };

  return (
    <ScreenWrapper>
      <Text style={styles.heading}>Inbox</Text>

      {chats.length === 0 && (
        <Text style={styles.empty}>No chats yet</Text>
      )}

      <FlatList
        data={chats}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openChat(item)}
            style={styles.chatItem}
          >
            <Text style={styles.name}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </ScreenWrapper>
  );
};

export default Inbox;

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: "700",
    marginVertical: 20,
  },
  empty: {
    fontSize: 16,
    color: "gray",
    marginTop: 20,
  },
  chatItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  name: {
    fontSize: 18,
  },
});
