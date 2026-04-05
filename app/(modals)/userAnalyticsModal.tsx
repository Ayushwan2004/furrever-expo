import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { 
    View, StyleSheet, ActivityIndicator, 
    TouchableOpacity, InteractionManager, Platform, FlatList
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/config/firebase';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

import ScreenWrapper from '@/components/ScreenWrapper';
import Typo from '@/components/Typo';
import BackButton from '@/components/BackButton';
import CategoryCard from '@/components/CategoryCard';
import Header from '@/components/Header';
import { colors, radius, spacingX, spacingY } from '@/constants/themes';
import { 
    Envelope, ShieldCheck, PawPrint, 
    Clock, Storefront, IdentificationCard, 
    CaretRight
} from 'phosphor-react-native';

import { UserType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { usePets } from '@/contexts/PetContext';

const UserAnalyticsModal = () => {
    const { userId: paramUserId } = useLocalSearchParams();
    const { user: currentUser } = useAuth();
    const { pets, toggleFavorite } = usePets();
    const router = useRouter();
    
    const targetUserId = (paramUserId as string) || currentUser?.uid;
    const isRespectiveUser = currentUser?.uid === targetUserId;

    const [isReady, setIsReady] = useState(false);
    const [userData, setUserData] = useState<UserType | null>(null);
    const [statAdoptions, setStatAdoptions] = useState(0);
    const [loading, setLoading] = useState(true);

    const isActionBusy = useRef(false);
    const isMounted = useRef(true);

    // 1. STABLE CLEANUP
    useEffect(() => {
        isMounted.current = true;
        const task = InteractionManager.runAfterInteractions(() => {
            if (isMounted.current) {
                setIsReady(true);
                fetchAnalyticsData();
            }
        });
        return () => {
            isMounted.current = false;
            task.cancel();
        };
    }, []);

    const fetchAnalyticsData = async () => {
        if (!targetUserId) return;
        try {
            const userSnap = await getDoc(doc(firestore, "users", targetUserId));
            
            // Check mount status before every state update
            if (!isMounted.current) return;
            if (userSnap.exists()) setUserData(userSnap.data() as UserType);

            const adoptQuery = query(
                collection(firestore, "adoptions"), 
                where("adopterId", "==", targetUserId), 
                where("status", "==", "approved")
            );
            const adoptSnap = await getDocs(adoptQuery);
            
            if (isMounted.current) {
                setStatAdoptions(adoptSnap.size);
                setLoading(false);
            }
        } catch (e) {
            console.error("Analytics Error:", e);
            if (isMounted.current) setLoading(false);
        }
    };

    const userPets = useMemo(() => {
        if (!isReady) return [];
        return pets.filter(p => p.ownerId === targetUserId && !p.isDeleted);
    }, [pets, targetUserId, isReady]);

    const activeListingsCount = useMemo(() => {
        return userPets.filter(p => p.status === 'available').length;
    }, [userPets]);

    const handleSafeNavigate = useCallback((path: string, params?: Record<string, any>) => {
        if (isActionBusy.current) return;
        isActionBusy.current = true;
        Haptics.selectionAsync();
        router.push({ pathname: path as any, params });
        setTimeout(() => { isActionBusy.current = false; }, 800);
    }, [router]);

    const renderHeader = () => (
        <View>
            <View style={styles.profileBox}>
                <View style={styles.avatarContainer}>
                    <Image 
                        source={userData?.image ? { uri: userData.image } : require('../../assets/Avatar.jpg')} 
                        style={styles.avatar}
                        contentFit="cover"
                        transition={150}
                    />
                    <View style={styles.statusDot} />
                </View>
                <Typo size={26} fontWeight="800" style={{ marginTop: 12 }}>{userData?.name || "User"}</Typo>
                
                <View style={[styles.badge, { backgroundColor: userData?.role === 'seller' ? colors.primary + '15' : colors.green + '15' }]}>
                    <ShieldCheck size={14} color={userData?.role === 'seller' ? colors.primary : colors.green} weight="fill" />
                    <Typo size={11} color={userData?.role === 'seller' ? colors.primary : colors.green} fontWeight="800">
                        VERIFIED {userData?.role?.toUpperCase() || 'MEMBER'}
                    </Typo>
                </View>

                <View style={styles.accountInfoRow}>
                    <View style={styles.infoPill}>
                        <Envelope size={14} color={colors.textLighter} />
                        <Typo size={13} color={colors.textLighter}>{userData?.email || "Private"}</Typo>
                    </View>
                </View>
            </View>

            <View style={styles.statsGrid}>
                <TouchableOpacity 
                    disabled={!isRespectiveUser}
                    onPress={() => handleSafeNavigate("/(modals)/adoptionHistoryModal")}
                    activeOpacity={0.7}
                    style={styles.statCard}
                >
                    <View style={[styles.statIconCircle, { backgroundColor: colors.primary + '10' }]}>
                        <PawPrint size={24} color={colors.primary} weight="duotone" />
                    </View>
                    <Typo size={22} fontWeight="800">{statAdoptions}</Typo>
                    <Typo size={12} color={colors.textLighter}>Adoptions</Typo>
                    {isRespectiveUser && (
                        <View style={styles.viewLink}>
                            <Typo size={10} color={colors.primary} fontWeight="700">CERTIFICATES</Typo>
                            <CaretRight size={10} color={colors.primary} weight="bold" />
                        </View>
                    )}
                </TouchableOpacity>
                
                <View style={styles.statCard}>
                    <View style={[styles.statIconCircle, { backgroundColor: colors.green + '10' }]}>
                        <Storefront size={24} color={colors.green} weight="duotone" />
                    </View>
                    <Typo size={22} fontWeight="800">{activeListingsCount}</Typo>
                    <Typo size={12} color={colors.textLighter}>Active Pets</Typo>
                </View>
            </View>

            <View style={styles.sectionHeader}>
                <IdentificationCard size={22} color={colors.text} weight="duotone" />
                <Typo size={18} fontWeight="800">Published Listings</Typo>
            </View>
        </View>
    );

    if (!isReady || loading) {
        return (
            <ScreenWrapper style={styles.centered}>
                <ActivityIndicator size="small" color={colors.primary} />
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper style={styles.container}>
            <View style={styles.headerNav}>
                <Header title="Member Insights" leftIcon={<BackButton />} />
            </View>

            <FlatList
                data={userPets}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={renderHeader}
                renderItem={({ item }) => (
                    <View style={{ paddingHorizontal: 5 }}>
                        <CategoryCard 
                            pet={item}
                            isFavorite={currentUser?.favorites?.includes(item.id) || false}
                            onFavoritePress={() => toggleFavorite(item.id)}
                            onCardPress={() => handleSafeNavigate("/(modals)/petDetailsModal", { id: item.id })}
                        />
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={styles.emptyState}>
                        <PawPrint size={40} color={colors.backgroundDark} weight="duotone" />
                        <Typo color={colors.textLighter} style={{marginTop: 10}}>No public listings found.</Typo>
                    </View>
                )}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                // VITAL FOR PERFORMANCE:
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    headerNav: { paddingHorizontal: spacingX._15 },
    scrollContent: { paddingBottom: 40 },
    profileBox: { alignItems: 'center', marginTop: 10, marginBottom: 20 },
    avatarContainer: { position: 'relative', width: 110, height: 110 },
    avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: 'white', backgroundColor: colors.backgroundDark },
    statusDot: { position: 'absolute', bottom: 5, right: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.green, borderWidth: 3, borderColor: 'white' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius._12, marginTop: 12 },
    accountInfoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, backgroundColor: colors.white, paddingHorizontal: 15, paddingVertical: 10, borderRadius: radius._15, borderWidth: 1, borderColor: colors.backgroundDark },
    infoPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statsGrid: { flexDirection: 'row', gap: 15, paddingHorizontal: spacingX._20, marginBottom: 30 },
    statCard: { flex: 1, backgroundColor: colors.white, padding: 20, borderRadius: radius._20, alignItems: 'center', borderWidth: 1, borderColor: colors.backgroundDark, minHeight: 140 },
    statIconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    viewLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15, paddingHorizontal: spacingX._20 },
    emptyState: { padding: 50, alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(UserAnalyticsModal);