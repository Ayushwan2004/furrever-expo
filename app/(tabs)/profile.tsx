import React, { useMemo, useRef, useCallback, memo, useState } from "react";
import { Alert, StyleSheet, TouchableOpacity, View, ScrollView, InteractionManager } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from 'expo-haptics';
import { User, ChartBar, Lock, Power, CaretRight, PawPrint, SignIn, UserCirclePlus } from "phosphor-react-native";

import Header from "@/components/Header";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/themes";
import { useAuth } from "@/contexts/AuthContext";
import { getProfileImage } from "@/services/imageService";
import { verticalScale, scale } from "@/utils/styling";

const ProfileItem = memo(({ item, index, onPress }: any) => (
  <Animated.View entering={FadeInDown.delay(index * 50).springify()} style={styles.listItem}><TouchableOpacity style={styles.itemButton} onPress={() => onPress(item)} activeOpacity={0.7}><View style={[styles.listIcon, { backgroundColor: item.bgColor }]}>{item.icon}</View><Typo size={17} style={{ flex: 1 }} fontWeight="700">{item.title}</Typo><CaretRight size={20} weight="bold" color={colors.gray} /></TouchableOpacity></Animated.View>
));

const Profile = () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const isActionInProgress = useRef(false);

  const handleAction = useCallback(async (item: any) => {
    if (isActionInProgress.current) return;
    isActionInProgress.current = true;
    Haptics.selectionAsync();

    if (item.title === "Log Out") {
      Alert.alert("Logout", "Are you sure you want to logout?", [{ text: "Cancel", style: "cancel", onPress: () => { isActionInProgress.current = false; } }, { text: "Logout", style: "destructive", onPress: async () => { try { await logout(); } finally { isActionInProgress.current = false; } } }]);
      return;
    }

    if (item.routeName) {
      const isInModal = (segments as string[]).includes("(modals)");
      InteractionManager.runAfterInteractions(() => {
        if (isInModal) router.replace(item.routeName as any);
        else router.push(item.routeName as any);
        setTimeout(() => { isActionInProgress.current = false; }, 800);
      });
    } else { isActionInProgress.current = false; }
  }, [logout, router, segments]);

  const accountOptions = useMemo(() => [
    { title: "Edit Profile", icon: <User size={24} color="white" weight="fill" />, routeName: "/(modals)/profileModal", bgColor: colors.blue },
    { title: "Analytics", icon: <ChartBar size={24} color="white" weight="fill" />, routeName: "/(modals)/userAnalyticsModal", bgColor: colors.lightgreen },
    { title: "Privacy Policy", icon: <Lock size={24} color="white" weight="fill" />, routeName: "/(modals)/privacyPolicyModal", bgColor: colors.text },
    { title: "Log Out", icon: <Power size={24} color="white" weight="fill" />, bgColor: colors.red },
  ], []);

  if (!user) {
    return (
      <ScreenWrapper style={{ backgroundColor: colors.background }}>
        <View style={styles.guestContainer}><View style={styles.playfulIconCircle}><PawPrint size={scale(70)} color={colors.primary} weight="fill" /></View><Typo size={30} fontWeight="800" style={styles.textCenter}>Join the Pack!</Typo><Typo size={16} color={colors.textLighter} style={[styles.textCenter, { marginTop: 10, paddingHorizontal: 20 }]}>Create a profile to save your favorite pets and manage adoptions.</Typo><View style={styles.guestActionColumn}><TouchableOpacity style={styles.primaryJoinBtn} onPress={() => router.push('/(auth)/register')} activeOpacity={0.8}><Typo color="white" fontWeight="700" size={18}>Get Started</Typo></TouchableOpacity><TouchableOpacity style={styles.secondaryJoinBtn} onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}><Typo color={colors.text} fontWeight="700" size={18}>Sign In</Typo></TouchableOpacity></View></View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={{ backgroundColor: colors.background }}><ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}><Header title="Profile" style={{ marginVertical: spacingY._10 }} /><View style={styles.userInfo}><Image source={getProfileImage(user?.image)} style={styles.avatar} contentFit="cover" transition={150} cachePolicy="memory-disk" /><View style={styles.nameContainer}><Typo size={24} fontWeight="800" color={colors.text}>{user?.name}</Typo><Typo size={15} fontWeight="600" color={colors.textLighter}>{user?.email}</Typo></View></View><View style={styles.accountOptions}>{accountOptions.map((item, index) => (<ProfileItem key={item.title} item={item} index={index} onPress={handleAction} />))}</View></ScrollView></ScreenWrapper>
  );
};

export default memo(Profile);

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacingX._20, paddingBottom: 100 },
  userInfo: { marginTop: verticalScale(20), alignItems: "center", gap: spacingY._15 },
  nameContainer: { alignItems: "center" },
  avatar: { height: verticalScale(130), width: verticalScale(130), borderRadius: 65, borderWidth: 4, borderColor: 'white', backgroundColor: colors.backgroundDark },
  accountOptions: { marginTop: spacingY._30, backgroundColor: 'white', borderRadius: radius._20, padding: 10 },
  listItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.background },
  itemButton: { flexDirection: "row", alignItems: "center", gap: spacingX._15 },
  listIcon: { height: 44, width: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  guestContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  playfulIconCircle: { width: 140, height: 140, backgroundColor: 'white', borderRadius: 70, justifyContent: 'center', alignItems: 'center', marginBottom: 30, elevation: 10 },
  textCenter: { textAlign: 'center' },
  guestActionColumn: { width: '100%', marginTop: spacingY._40, gap: spacingY._15 },
  primaryJoinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.green, height: 58, borderRadius: radius._20 },
  secondaryJoinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background, height: 58, borderRadius: radius._20, borderWidth: 2, borderColor: colors.green }
});