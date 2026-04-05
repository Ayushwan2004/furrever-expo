import React, { useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { StyleSheet, FlatList, View, InteractionManager } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { HeartStraight } from 'phosphor-react-native';

import ScreenWrapper from '@/components/ScreenWrapper';
import Typo from '@/components/Typo';
import CategoryCard from '@/components/CategoryCard';
import { usePets } from '@/contexts/PetContext';
import { useAuth } from '@/contexts/AuthContext';
import { spacingX, spacingY, colors } from '@/constants/themes';

const Favourite = () => {
  const { pets, toggleFavorite } = usePets();
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const isNavigating = useRef(false);

  const favoritePets = useMemo(() => {
    if (!user?.favorites) return [];
    return pets.filter(pet => user.favorites?.includes(pet.id) && !pet.isDeleted);
  }, [pets, user?.favorites]);

  const onCardPress = useCallback((id: string) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    
    const isInModal = (segments as string[]).includes("(modals)");
    InteractionManager.runAfterInteractions(() => {
        if (isInModal) router.replace({ pathname: "/(modals)/petDetailsModal", params: { id } });
        else router.push({ pathname: "/(modals)/petDetailsModal", params: { id } });
        setTimeout(() => { isNavigating.current = false; }, 800);
    });
  }, [router, segments]);

  if (!user) {
    return (
      <ScreenWrapper style={styles.container}>
        <View style={styles.header}><Typo size={28} fontWeight="800">My Favorites</Typo></View>
        <View style={styles.guestContainer}>
          <View style={styles.iconCircle}><HeartStraight size={40} color={colors.textLighter} weight="duotone" /></View>
          <Typo size={20} fontWeight="700" color={colors.text}>No favorites yet</Typo>
          <Typo color={colors.textLight} style={styles.guestSub}>You'll see all your saved buddies here once you start hearting them.</Typo>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.header}>
        <Typo size={28} fontWeight="800">My Favorites</Typo>
        <Typo color={colors.textLight} size={15}>{favoritePets.length} {favoritePets.length === 1 ? 'buddy' : 'buddies'} saved</Typo>
      </View>
      <FlatList data={favoritePets} keyExtractor={(item) => item.id} renderItem={({ item }) => <CategoryCard pet={item} isFavorite={true} onFavoritePress={() => toggleFavorite(item.id)} onCardPress={() => onCardPress(item.id)} />} ListEmptyComponent={<EmptyFavorites />} contentContainerStyle={styles.listContent} removeClippedSubviews={true} initialNumToRender={5} />
    </ScreenWrapper>
  );
};

const EmptyFavorites = () => (
  <View style={styles.empty}><HeartStraight size={64} color={colors.backgroundDark} weight="duotone" /><Typo color={colors.textLight} fontWeight="600">Your favorites list is empty</Typo><Typo color={colors.textLighter} size={14} style={styles.emptySub}>Buddies you heart will appear here!</Typo></View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacingX._20, paddingVertical: spacingY._20, gap: 4 },
  listContent: { paddingBottom: spacingY._30 },
  empty: { flex: 1, alignItems: 'center', marginTop: 120, gap: 8, paddingHorizontal: spacingX._40 },
  emptySub: { textAlign: 'center' },
  guestContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.backgroundDark, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  guestSub: { textAlign: 'center', marginTop: 10, lineHeight: 22 },
});

export default memo(Favourite);