import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  memo,
  useEffect,
} from "react";
import {
  FlatList,
  StyleSheet,
  View,
  Alert,
  TouchableOpacity,
  Text,
  RefreshControl,
  Animated,
  InteractionManager,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { BellSimple, Plus, PawPrint } from "phosphor-react-native";
import { Image } from "expo-image";
import { writeBatch, doc } from "firebase/firestore";

import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import Button from "@/components/Button";
import Category from "@/components/Category";
import CategoryCard from "@/components/CategoryCard";
import BellaChatbot from "@/components/BellaChatbot"; 

import { colors, spacingX, spacingY, radius } from "@/constants/themes";
import { useAuth } from "@/contexts/AuthContext";
import { usePets } from "@/contexts/PetContext";
import { useAdoption } from "@/contexts/AdoptionContext";
import { firestore } from "@/config/firebase";
import { verticalScale } from "@/utils/styling";

// ==========================================
// 🦴 HARDWARE-ACCELERATED SKELETONS
// ==========================================
const SkeletonPulse = ({ style }: { style: any }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return <Animated.View style={[style, { opacity, backgroundColor: colors.backgroundDark }]} />;
};

const CategorySkeleton = () => (
  <View style={styles.categorySkeletonRow}>
    {[1, 2, 3, 4, 5].map((i) => (
      <SkeletonPulse key={i} style={styles.categoryPillSkeleton} />
    ))}
  </View>
);

const CardSkeleton = () => (
  <View style={styles.cardSkeletonContainer}>
    <SkeletonPulse style={styles.cardImageSkeleton} />
    <View style={styles.cardTextSkeletonRow}>
      <SkeletonPulse style={styles.cardTitleSkeleton} />
      <SkeletonPulse style={styles.cardIconSkeleton} />
    </View>
    <SkeletonPulse style={styles.cardSubtitleSkeleton} />
  </View>
);

// ==========================================
// 🔔 NOTIFICATION BADGE
// ==========================================
const NotificationBadge = memo(({ count }: { count: number }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count > 0) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 4,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [count]);

  if (count <= 0) return null;

  return (
    <Animated.View style={[styles.badgeContainer, { transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </Animated.View>
  );
});

/* -------------------------------------------------------------------------- */
/* HEADER                                                                      */
/* -------------------------------------------------------------------------- */
const ListHeader = memo(
  ({
    user,
    notificationCount,
    selectedCategory,
    setSelectedCategory,
    onBellPress,
    onProtectedNav,
    isInitialLoading,
  }: any) => (
    <View style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <View style={{ gap: 4 }}>
          <Typo size={16} fontWeight="700">Hey! Pet lover,</Typo>
          <Typo size={22} fontWeight="800" color={colors.textLighter}>
            {user?.name || "Guest"}
          </Typo>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onBellPress} style={styles.iconBtn} activeOpacity={0.7}>
            <BellSimple size={28} color={colors.text} weight="duotone" />
            <NotificationBadge count={notificationCount} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onProtectedNav("/(tabs)/profile")}>
            <View style={styles.avatarContainer}>
              <Image
                source={user?.image ? { uri: user.image } : require("../../assets/Avatar.jpg")}
                style={styles.avatarImage}
                cachePolicy="memory-disk"
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Button
          style={[styles.actionBtn, { backgroundColor: colors.primarySoft }]}
          onPress={() => onProtectedNav("/(modals)/PetListModal")}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
            <Plus size={18} color="white" weight="bold" />
          </View>
          <Typo size={14} fontWeight="700" color={colors.primaryDark}>Add Pet</Typo>
        </Button>

        <Button
          style={[styles.actionBtn, { backgroundColor: colors.successSoft }]}
          onPress={() => onProtectedNav("/(modals)/myPetsModal")}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.lightgreen }]}>
            <PawPrint size={18} color="white" weight="fill" />
          </View>
          <Typo size={14} fontWeight="700" color={colors.textLight}>My Pets</Typo>
        </Button>
      </View>

      {isInitialLoading ? (
        <CategorySkeleton />
      ) : (
        <Category
          selectedCategory={selectedCategory}
          onCategorySelect={(cat: string) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedCategory(cat);
          }}
        />
      )}

      <Typo size={18} fontWeight="800" style={styles.sectionTitle}>
        {isInitialLoading ? "" : (selectedCategory === "All" ? "New Buddies" : `${selectedCategory} for you`)}
      </Typo>
    </View>
  )
);

/* -------------------------------------------------------------------------- */
/* HOME                                                                        */
/* -------------------------------------------------------------------------- */
const Home = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { pets, toggleFavorite } = usePets();
  const { applications } = useAdoption();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const actionLock = useRef(false);

  useEffect(() => {
    if (pets.length > 0) {
      setIsInitialLoading(false);
    } else {
      const timer = setTimeout(() => setIsInitialLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [pets.length]);

  const notificationCount = useMemo(() => {
    if (!user?.uid) return 0;
    return applications.filter(
      (app) => app.ownerId === user.uid && app.status === "pending" && app.isRead === false
    ).length;
  }, [applications, user?.uid]);

  const markApplicationsAsRead = useCallback(async () => {
    if (!user?.uid) return;
    const unread = applications.filter((app) => app.ownerId === user.uid && app.isRead === false);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(firestore);
      unread.forEach((app) => {
        batch.update(doc(firestore, "adoptions", app.id), { isRead: true });
      });
      await batch.commit();
    } catch (e) {
      console.error("Mark read failed", e);
    }
  }, [applications, user?.uid]);

  const filteredPets = useMemo(() => {
    const active = pets.filter((p) => !p.isDeleted && p.status !== "sold");
    if (selectedCategory === "All") return active;
    if (selectedCategory === "Others")
      return active.filter((p) => !["Dogs", "Cats", "Birds"].includes(p.category));
    return active.filter((p) => p.category === selectedCategory);
  }, [pets, selectedCategory]);

  const handleProtectedAction = useCallback(
    (cb: () => void) => {
      if (actionLock.current) return;
      actionLock.current = true;

      if (!user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Join the Pack 🐾", "Sign in to continue.", [
          { text: "Later", style: "cancel", onPress: () => { actionLock.current = false; } },
          { text: "Sign In", onPress: () => { actionLock.current = false; router.push("/(auth)/login"); } },
        ]);
        return;
      }

      InteractionManager.runAfterInteractions(() => {
        cb();
        setTimeout(() => (actionLock.current = false), 800);
      });
    },
    [user]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background }}>
        <FlatList
          data={isInitialLoading ? ([1, 2, 3] as any) : filteredPets}
          keyExtractor={(item, index) =>
            isInitialLoading ? `skel-${index}` : item.id
          }
          renderItem={({ item }) => {
            if (isInitialLoading) return <CardSkeleton />;
            return (
              <CategoryCard
                pet={item}
                isFavorite={item.favoredBy.includes(user?.uid || "")}
                onFavoritePress={() => handleProtectedAction(() => toggleFavorite(item.id))}
                onCardPress={() =>
                  handleProtectedAction(() =>
                    router.push({
                      pathname: "/(modals)/petDetailsModal",
                      params: { id: item.id },
                    })
                  )
                }
              />
            );
          }}
          ListHeaderComponent={
            <ListHeader
              user={user}
              notificationCount={notificationCount}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              isInitialLoading={isInitialLoading}
              onProtectedNav={(path: string) =>
                handleProtectedAction(() => router.push(path as any))
              }
              onBellPress={() =>
                handleProtectedAction(async () => {
                  await markApplicationsAsRead();
                  router.push("/(modals)/applicationsModal");
                })
              }
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setTimeout(() => setRefreshing(false), 700);
              }}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
        />
      </ScreenWrapper>

      {/* Bella AI — floats above everything, no layout impact */}
      <BellaChatbot />
    </View>
  );
};

export default memo(Home);

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacingX._20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacingY._20,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 15 },
  iconBtn: { padding: 4, position: "relative" },
  badgeContainer: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: colors.red,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: "white", fontSize: 9, fontWeight: "800" },
  avatarContainer: {
    width: verticalScale(50),
    height: verticalScale(50),
    borderRadius: radius._40,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.backgroundDark,
  },
  avatarImage: { width: "100%", height: "100%" },
  buttonRow: {
    flexDirection: "row",
    gap: 15,
    paddingHorizontal: spacingX._20,
    marginVertical: spacingY._17,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    gap: spacingX._10,
    borderWidth: 1,
    borderColor: colors.backgroundDark,
    alignItems: "center",
    height: verticalScale(55),
    borderRadius: radius._15,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius._10,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  sectionTitle: {
    marginLeft: spacingX._20,
    marginTop: 20,
    marginBottom: 10,
    minHeight: 25,
  },
  /* Skeleton Styles */
  categorySkeletonRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: spacingX._20,
    marginVertical: verticalScale(12),
  },
  categoryPillSkeleton: {
    width: 85,
    height: verticalScale(42),
    borderRadius: radius._40,
  },
  cardSkeletonContainer: {
    marginHorizontal: spacingX._20,
    marginBottom: spacingY._20,
    padding: 14,
    borderRadius: radius._20,
    borderWidth: 1,
    borderColor: colors.backgroundDark,
    backgroundColor: colors.white,
  },
  cardImageSkeleton: {
    width: "100%",
    height: verticalScale(180),
    borderRadius: radius._15,
    marginBottom: 14,
  },
  cardTextSkeletonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitleSkeleton: { width: "55%", height: 22, borderRadius: 8 },
  cardIconSkeleton:  { width: 28,    height: 28, borderRadius: 14 },
  cardSubtitleSkeleton: { width: "35%", height: 16, borderRadius: 6 },
});