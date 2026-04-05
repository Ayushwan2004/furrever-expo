import React, { memo, useEffect, useRef, useState, useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { CaretRight, CheckCircle, Clock, Heart, MapPin, PawPrint, Trash } from "phosphor-react-native";
import * as Haptics from 'expo-haptics';

import Typo from "./Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/themes";
import { getPetImage } from "@/services/imageService";
import { useAuth } from "@/contexts/AuthContext";
import { PetType } from "@/types";
import { getTimeElapsed } from "@/utils/date";
import { verticalScale, scale } from "@/utils/styling";

type CategoryCardProps = {
  pet: PetType;
  onFavoritePress: () => void;
  onCardPress: () => void;
  isFavorite: boolean;
};

const CategoryCard: React.FC<CategoryCardProps> = ({
  pet,
  onFavoritePress,
  onCardPress,
  isFavorite,
}) => {
  const { user } = useAuth();
  const isActionInProgress = useRef(false);
  const isOwner = pet.ownerId === user?.uid;

  const [ticker, setTicker] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTicker(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleFavorite = useCallback((e: any) => {
    e.stopPropagation();
    if (isActionInProgress.current) return;
    
    isActionInProgress.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onFavoritePress();
    
    setTimeout(() => { isActionInProgress.current = false; }, 500);
  }, [onFavoritePress]);

  return (
    <TouchableOpacity 
      style={[styles.card, pet.isDeleted && { opacity: 0.7 }]} 
      onPress={onCardPress} 
      activeOpacity={0.9}
    >
      <View style={styles.imageWrapper}>
        <Image
          source={getPetImage(pet.image)}
          style={styles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />

        <View style={styles.badgeContainer}>
          {pet.isDeleted ? (
            <View style={[styles.statusBadge, { backgroundColor: colors.red }]}>
              <Trash size={12} color="white" weight="fill" />
              <Text style={styles.statusText}>Trashed</Text>
            </View>
          ) : pet.status === 'sold' ? (
            <View style={[styles.statusBadge, { backgroundColor: colors.green }]}>
              <CheckCircle size={12} color="white" weight="fill" />
              <Text style={styles.statusText}>Sold</Text>
            </View>
          ) : (
            <View style={styles.categoryTag}><Text style={styles.categoryText}>{pet.category}</Text></View>
          )}
        </View>

        {!isOwner && !pet.isDeleted && (
          <TouchableOpacity style={styles.favButton} onPress={handleFavorite} activeOpacity={0.7}>
            <Heart size={22} color={isFavorite ? colors.red : colors.white} weight={isFavorite ? "fill" : "bold"} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.headerRow}>
          <Typo size={18} fontWeight="800" textProps={{ numberOfLines: 1 }} style={{ flex: 1 }}>{pet.name}</Typo>
          <Text style={styles.ageText}>{pet.age ? `${pet.age} yrs` : "Baby"}</Text>
        </View>

        <View style={styles.attributeRow}>
          <View style={styles.attributeItem}>
            <PawPrint size={14} color={colors.primary} weight="duotone" />
            <Text style={styles.attributeText} numberOfLines={1}>{pet.breed}</Text>
          </View>
          <View style={styles.attributeItem}>
            <Clock size={14} color={colors.textLighter} weight="regular" />
            <Text style={styles.timeText}>{getTimeElapsed(pet.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.addressRow}>
            <MapPin size={14} color={colors.primary} weight="bold" />
            <Text style={styles.address} numberOfLines={1}>{pet.address}</Text>
          </View>
          <View style={styles.seeMore}>
            <Text style={styles.seeMoreText}>Details</Text>
            <CaretRight size={12} color={colors.green} weight="bold" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default memo(CategoryCard);


const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius._20, marginVertical: spacingY._10, marginHorizontal: spacingX._15, elevation: 5, shadowColor: colors.black, shadowOpacity: 0.1, shadowRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.backgroundDark },
  imageWrapper: { position: "relative", width: "100%", height: verticalScale(180) },
  image: { width: "100%", height: "100%", backgroundColor: colors.backgroundDark },
  badgeContainer: { position: 'absolute', top: 12, left: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius._10 },
  statusText: { color: 'white', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  favButton: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.4)", padding: 8, borderRadius: radius._12, zIndex: 10 },
  categoryTag: { backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius._10 },
  categoryText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  info: { padding: 15, gap: 6 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ageText: { fontSize: 12, fontWeight: "700", color: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius._10 },
  attributeRow: { flexDirection: "row", alignItems: "center", gap: 15, justifyContent: 'space-between' },
  attributeItem: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  attributeText: { fontSize: 13, color: colors.textLight },
  timeText: { fontSize: 11, color: colors.textLighter },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.backgroundDark, paddingTop: 10, marginTop: 4 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1, paddingRight: 10 },
  address: { fontSize: 12, color: colors.textLighter, flex: 1 },
  seeMore: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeMoreText: { fontSize: 12, fontWeight: "700", color: colors.green },
});