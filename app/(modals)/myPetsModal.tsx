import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowCounterClockwise, CheckCircle, Info, PencilLine, Trash } from 'phosphor-react-native';

import BackButton from '@/components/BackButton';
import CategoryCard from '@/components/CategoryCard';
import Header from '@/components/Header';
import ScreenWrapper from '@/components/ScreenWrapper';
import Typo from '@/components/Typo';
import Button from '@/components/Button';

import { colors, radius, spacingX, spacingY } from '@/constants/themes';
import { useAuth } from '@/contexts/AuthContext';
import { usePets } from '@/contexts/PetContext';
import { useAdoption } from '@/contexts/AdoptionContext';
import { verticalScale } from '@/utils/styling';

const MyPetsModal = () => {
    const { pets, deletePet, markAsSold, updatePet } = usePets();
    const { user } = useAuth();
    const router = useRouter();
    
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const isBusy = useRef(false);

    const myPets = useMemo(() => pets.filter((p) => p.ownerId === user?.uid), [pets, user?.uid]);

    const handleAction = async (id: string, actionFn: () => Promise<any>) => {
        if (isBusy.current) return;
        isBusy.current = true;
        setActionLoadingId(id);

        try {
            const res = await actionFn();
            if (res.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Alert.alert("Action Failed", res.msg);
            }
        } catch (e) {
            Alert.alert("Error", "Something went wrong");
        } finally {
            setActionLoadingId(null);
            isBusy.current = false;
        }
    };

    const renderPetItem = useCallback(({ item }: { item: any }) => {
        const isSold = item.status === 'sold';
        const isTrashed = item.isDeleted;
        const isLoading = actionLoadingId === item.id;

        return (
            <View style={[styles.cardWrapper, isTrashed && styles.trashedOpacity]}>
                <CategoryCard 
                    pet={item} 
                    isFavorite={false} 
                    onFavoritePress={() => {}} 
                    onCardPress={() => {
                        if (isTrashed) return Alert.alert("Listing Removed", "Restore the buddy to view details.");
                        router.push({ pathname: "/(modals)/petDetailsModal", params: { id: item.id }});
                    }}
                />

                <View style={styles.buttonRow}>
                    {isTrashed ? (
                        <Button 
                            loading={isLoading}
                            style={[styles.actionBtn, { backgroundColor: colors.successSoft }]} 
                            onPress={() => handleAction(item.id, () => updatePet(item.id, { isDeleted: false, status: 'available' }))}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: colors.lightgreen }]}>
                                <ArrowCounterClockwise size={16} color="white" weight="bold" />
                            </View>
                            <Typo size={13} fontWeight="700" color={colors.textLight}>Restore Listing</Typo>
                        </Button>
                    ) : (
                        <>
                            {!isSold && (
                                <Button 
                                    style={[styles.actionBtn, { backgroundColor: colors.primarySoft }]} 
                                    onPress={() => router.push({ pathname: "/(modals)/PetListModal", params: { id: item.id, mode: 'edit' }})}
                                >
                                    <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
                                        <PencilLine size={16} color="white" weight="bold" />
                                    </View>
                                    <Typo size={13} fontWeight="700" color={colors.primaryDark}>Edit</Typo>
                                </Button>
                            )}
                            
                            {!isSold ? (
                                <Button 
                                    loading={isLoading}
                                    style={[styles.actionBtn, { backgroundColor: colors.successSoft }]} 
                                    onPress={() => handleAction(item.id, () => markAsSold(item.id, "direct_sale"))}
                                >
                                    <View style={[styles.actionIcon, { backgroundColor: colors.lightgreen }]}>
                                        <CheckCircle size={16} color="white" weight="bold" />
                                    </View>
                                    <Typo size={13} fontWeight="700" color={colors.textLight}>Mark Sold</Typo>
                                </Button>
                            ) : (
                                <View style={[styles.actionBtn, styles.soldLabel]}>
                                    <CheckCircle size={18} color={colors.white} weight="fill" />
                                    <Typo size={13} color={colors.white} fontWeight="800">ADOPTED</Typo>
                                </View>
                            )}

                            <Button 
                                loading={isLoading}
                                style={[styles.actionBtn, styles.deleteBtn]} 
                                onPress={() => handleAction(item.id, () => deletePet(item.id))}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: colors.red }]}>
                                    <Trash size={16} color="white" weight="bold" />
                                </View>
                                <Typo size={13} fontWeight="700" color={colors.red}>Remove</Typo>
                            </Button>
                        </>
                    )}
                </View>
            </View>
        );
    }, [user?.uid, router, updatePet, deletePet, markAsSold, actionLoadingId]);

    return (
        <ScreenWrapper style={styles.container}>
            <View style={styles.headerContainer}><Header title="My Listings" leftIcon={<BackButton />} /></View>
            <FlatList
                data={myPets}
                keyExtractor={(item) => `${item.id}-${item.image}-${item.status}`} 
                renderItem={renderPetItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Info size={50} color={colors.textLighter} weight="duotone" />
                        <Typo color={colors.textLight} size={16} fontWeight="600" style={{marginTop: 12}}>No listings found</Typo>
                    </View>
                }
            />
        </ScreenWrapper>
    );
};

export default React.memo(MyPetsModal);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerContainer: { paddingHorizontal: spacingX._5, paddingBottom: spacingY._10 },
    listContent: { paddingBottom: verticalScale(60), paddingTop: spacingY._5 },
    cardWrapper: { marginBottom: spacingY._25 },
    trashedOpacity: { opacity: 0.6 },
    buttonRow: { flexDirection: "row", gap: 12, paddingHorizontal: spacingX._20, marginTop: -spacingY._5 },
    actionBtn: { flex: 1, flexDirection: 'row', gap: spacingX._5, borderWidth: 1, borderColor: colors.backgroundDark, justifyContent: "center", alignItems: "center", height: verticalScale(46), borderRadius: radius._15, backgroundColor: colors.white },
    actionIcon: { width: 28, height: 28, borderRadius: radius._10, justifyContent: "center", alignItems: "center" },
    deleteBtn: { backgroundColor: colors.red + '05', borderColor: colors.red + '15' },
    soldLabel: { backgroundColor: colors.green, borderColor: colors.green, flex: 2, height: verticalScale(46), borderRadius: radius._15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: verticalScale(150) }
});