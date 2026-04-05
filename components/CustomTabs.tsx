import React, { useMemo, useRef, useCallback, memo } from "react";
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  InteractionManager, // Critical for crash prevention
} from "react-native";
import { BlurView } from 'expo-blur';
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { House, Heart, Chat, User } from "phosphor-react-native";
import * as Haptics from 'expo-haptics';

import { colors, spacingY, radius } from "@/constants/themes";
import { verticalScale, scale } from "@/utils/styling";
import { useChat } from "@/contexts/chatContext";
import { useAuth } from "@/contexts/AuthContext";
import Typo from "@/components/Typo";

// 1. MEMOIZED ICON COMPONENT
// This prevents every icon from re-rendering when you switch tabs, saving UI thread resources.
const TabIcon = memo(({ routeName, isFocused, badgeCount }: { routeName: string, isFocused: boolean, badgeCount: number }) => {
  const iconColor = isFocused ? colors.primary : colors.textLight;
  const iconWeight = isFocused ? "fill" : "duotone";
  const iconSize = verticalScale(24);

  const renderIcon = () => {
    switch (routeName) {
      case "index": return <House size={iconSize} weight={iconWeight} color={iconColor} />;
      case "favourite": return <Heart size={iconSize} weight={iconWeight} color={iconColor} />;
      case "profile": return <User size={iconSize} weight={iconWeight} color={iconColor} />;
      case "inbox":
        return (
          <View>
            <Chat size={iconSize} weight={iconWeight} color={iconColor} />
            {badgeCount > 0 && (
              <View style={styles.badge}>
                <Typo color="white" size={10} fontWeight="800">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </Typo>
              </View>
            )}
          </View>
        );
      default: return null;
    }
  };

  return (
    <View style={[styles.pill, isFocused && styles.pillActive]}>
      {renderIcon()}
    </View>
  );
});

const CustomTabs = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const { rooms } = useChat();
  const { user } = useAuth();

  // 2. NAVIGATION LOCK
  // Prevents the user from spamming tabs and confusing the navigation stack
  const isNavigating = useRef(false);

  // 3. OPTIMIZED BADGE COUNT
  // Only recalculates when the 'rooms' array actually changes reference or user changes
  const unreadCount = useMemo(() => {
    if (!user?.uid || !rooms) return 0;
    return rooms.reduce((acc, room) => {
      const lastRead = room.lastRead?.[user.uid]?.toDate?.() || new Date(0);
      const updatedAt = room.updatedAt?.toDate ? room.updatedAt.toDate() : new Date(room.updatedAt || 0);
      return updatedAt > lastRead ? acc + 1 : acc;
    }, 0);
  }, [rooms, user?.uid]);

  // 4. CRASH-PROOF NAVIGATION HANDLER
  const handlePress = useCallback((route: any, isFocused: boolean) => {
    if (isNavigating.current) return;

    Haptics.selectionAsync();

    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      isNavigating.current = true;

      // [CRASH FIX]: Wait for the current frame/animation to finish before mounting the new heavy screen.
      // This allows the JS thread to clear up resources from the previous screen.
      InteractionManager.runAfterInteractions(() => {
        navigation.navigate(route.name, route.params);

        // Short timeout to allow the new screen to mount smoothly
        setTimeout(() => {
          isNavigating.current = false;
        }, 300);
      });
    }
  }, [navigation]);

  return (
    <View style={styles.container}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 100}
        tint="light"
        style={styles.tabBar}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          // Dynamic Route Check: Only render if we have an icon definition
          // (Prevents blank tabs if you add hidden routes later)
          if (!["index", "favourite", "inbox", "profile"].includes(route.name)) return null;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => handlePress(route, isFocused)}
              activeOpacity={0.7}
              style={styles.tabBarItem}
            >
              <TabIcon
                routeName={route.name}
                isFocused={isFocused}
                badgeCount={route.name === 'inbox' ? unreadCount : 0}
              />
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

export default memo(CustomTabs);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacingY._17,
    width: '100%',
    alignItems: 'center',
    paddingBottom: Platform.OS === "ios" ? spacingY._25 : spacingY._15,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabBar: {
    flexDirection: "row",
    width: "90%",
    height: verticalScale(68),
    borderRadius: radius._40,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: "space-around",
    alignItems: "center",
  },
  tabBarItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: '100%',
  },
  pill: {
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(16),
    borderRadius: radius._20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pillActive: {
    backgroundColor: colors.primary + '40',
    borderRadius: radius._40,
  },
  badge: {
    position: 'absolute',
    right: -scale(6),
    top: -verticalScale(4),
    backgroundColor: colors.red,
    borderRadius: radius._10,
    minWidth: verticalScale(18),
    height: verticalScale(18),
    paddingHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  }
});