
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { 
    Alert, ScrollView, StyleSheet, Text, 
    TouchableOpacity, View, Linking, Platform, ActivityIndicator 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics'; 
import {
    ArrowClockwise, Calendar, ChatCircleDots,
    CheckCircle, Envelope, Info, MapPin,
    Palette, PawPrint, SealCheck, Trash, XCircle,
    CaretRight, Handshake
} from 'phosphor-react-native';

import BackButton from '@/components/BackButton';
import Button from '@/components/Button';
import Header from '@/components/Header';
import ScreenWrapper from '@/components/ScreenWrapper';
import Typo from '@/components/Typo';
import { firestore } from '@/config/firebase';
import { colors, radius, spacingX, spacingY } from '@/constants/themes';
import { useAdoption } from '@/contexts/AdoptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/chatContext';
import { usePets } from '@/contexts/PetContext';
import { getPetImage } from '@/services/imageService';
import { PetType, UserType } from '@/types';
import { getTimeElapsed } from '@/utils/date';
import { verticalScale } from '@/utils/styling';

const InfoCard = React.memo(({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) => (
    <View style={styles.gridItem}>
        {icon}
        <Text numberOfLines={1} style={styles.gridValue}>{value}</Text>
        <Typo size={11} color={colors.textLighter}>{label}</Typo>
    </View>
));

const PetDetailsModal = () => {
    const { id } = useLocalSearchParams();
    const { pets } = usePets();
    const { sendApplication, cancelApplication, loading: adoptionLoading, applications } = useAdoption();
    const { getOrCreateChatRoom } = useChat();
    const { user: currentUser } = useAuth();
    const router = useRouter();

    const isBusy = useRef(false);

    const pet = useMemo(() => pets.find((p) => p.id === id) as PetType | undefined, [pets, id]);
    const [ownerData, setOwnerData] = useState<UserType | null>(null);
    const [adopterData, setAdopterData] = useState<UserType | null>(null);
    const [fetchingData, setFetchingData] = useState(true);

    const isSold = pet?.status === 'sold';
    const isOwner = pet?.ownerId === currentUser?.uid;

    const userApplication = useMemo(() => 
        applications.find(app => app.petId === pet?.id && app.adopterId === currentUser?.uid)
    , [applications, pet?.id, currentUser?.uid]);

    const applicationStatus = userApplication?.status;

    // --- EFFECT: REAL-TIME SYNC WITH PERMISSION GUARDS ---
    useEffect(() => {
        // If logged out or no owner, stop
        if (!currentUser || !pet?.ownerId) {
            setFetchingData(false);
            return;
        }

        setFetchingData(true);
        
        // Sync Owner Details
        const unsubOwner = onSnapshot(doc(firestore, "users", pet.ownerId), (snap) => {
            if (snap.exists()) setOwnerData(snap.data() as UserType);
            setFetchingData(false);
        }, (err) => {
            // Silently catch permission errors on logout
            if (err.code !== 'permission-denied') console.warn("Owner Fetch Error:", err);
            setFetchingData(false);
        });

        // Sync Adopter Details (Only if sold)
        let unsubAdopter = () => {};
        if (isSold && pet?.adoptedBy) {
            unsubAdopter = onSnapshot(doc(firestore, "users", pet.adoptedBy), (snap) => {
                if (snap.exists()) setAdopterData(snap.data() as UserType);
            }, (err) => {
                if (err.code !== 'permission-denied') console.warn("Adopter Fetch Error:", err);
            });
        }

        return () => { unsubOwner(); unsubAdopter(); };
    }, [pet?.ownerId, isSold, pet?.adoptedBy, currentUser?.uid]);

    // --- ACTIONS ---
    const handleThrottledAction = useCallback((action: () => void) => {
        if (isBusy.current) return;
        isBusy.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        action();
        setTimeout(() => { isBusy.current = false; }, 800);
    }, []);

    const handleAdopt = useCallback(async () => {
        if (isBusy.current || !pet) return;
        if (!currentUser) {
            handleThrottledAction(() => router.push("/(auth)/login"));
            return;
        }

        isBusy.current = true;
        const res = await sendApplication(pet);
        
        if (res.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                "Adoption Request Sent! 🐾",
                "The owner has been notified. Please wait for their response.",
                [{ text: "OK", style: "default" }]
            );
        } else {
            Alert.alert("Hold on", res.msg || "Something went wrong.");
        }
        setTimeout(() => { isBusy.current = false; }, 1000);
    }, [currentUser, pet, sendApplication, router]);

    const handleCancelRequest = useCallback(() => {
        if (!userApplication) return;
        
        Alert.alert(
            "Cancel Request?",
            "Are you sure you want to withdraw your adoption application?",
            [
                { text: "No", style: "cancel" },
                { 
                    text: "Yes, Cancel", 
                    style: "destructive", 
                    onPress: () => handleThrottledAction(() => cancelApplication(userApplication.id)) 
                }
            ]
        );
    }, [userApplication, cancelApplication]);

    const handleChatPress = useCallback(async () => {
        if (isBusy.current || !currentUser || !pet?.ownerId) return;
        isBusy.current = true;
        try {
            const roomId = await getOrCreateChatRoom(pet.ownerId, ownerData?.name || "Owner", ownerData?.image || "");
            if (roomId) {
                router.push({
                    pathname: "/(modals)/chatScreenModal",
                    params: { roomId, otherUserId: pet.ownerId, otherUserName: ownerData?.name }
                });
            }
        } finally { setTimeout(() => { isBusy.current = false; }, 800); }
    }, [currentUser, pet, ownerData]);

    const adoptButtonSection = useMemo(() => {
        // --- 1. OWNER COMPLETED CASE ---
        if (isOwner && isSold && pet?.adoptedBy) {
            // Highly Dynamic Adopter Name
            const adopterNameDisplay = fetchingData ? "Loading..." : (adopterData?.name || 'Buddy Adopter');

            return (
                <TouchableOpacity 
                    activeOpacity={0.8}
                    style={styles.adopterPillCard}
                    onPress={() => handleThrottledAction(() => router.push({ pathname: "/(modals)/userAnalyticsModal", params: { userId: pet.adoptedBy! }}))}
                >
                    <View style={styles.adopterAvatarWrapper}>
                        <Image source={adopterData?.image ? { uri: adopterData.image } : require('../../assets/Avatar.jpg')} style={styles.adopterAvatar} />
                        <View style={styles.checkBadge}><CheckCircle size={10} color="white" weight="fill" /></View>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Typo size={12} color={colors.textLighter} fontWeight="600">Adopted By</Typo>
                        <Typo size={16} fontWeight="800" color={colors.text}>{adopterNameDisplay}</Typo>
                    </View>
                    <CaretRight size={18} color={colors.textLighter} weight="bold" />
                </TouchableOpacity>
            );
        }

        // --- 2. OWNER LISTING CASE ---
        if (isOwner) return (
            <View style={styles.ownerListingInfo}><Info size={20} color={colors.primary} /><Typo color={colors.primary} fontWeight="700">You listed this buddy</Typo></View>
        );

        // --- 3. APPROVED CASE ---
        if (applicationStatus === 'approved') return (
            <View style={[styles.statusButton, { backgroundColor: colors.green }]}>
                <SealCheck size={22} color="white" weight="fill" />
                <Typo color="white" fontWeight="700">Application Approved!</Typo>
            </View>
        );

        // --- 4. REJECTED CASE (RESEND) ---
        if (applicationStatus === 'rejected') return (
            <View style={{ gap: 8, width: '100%' }}>
                <View style={[styles.statusButton, styles.rejectedBadge]}>
                    <XCircle size={20} color={colors.red} weight="fill" />
                    <Typo color={colors.red} fontWeight="700">Request Rejected</Typo>
                </View>
                <Button style={styles.resendBtn} onPress={handleAdopt} loading={adoptionLoading}>
                    <ArrowClockwise size={20} color="white" weight="bold" />
                    <Typo color="white" fontWeight="700">Resend Application</Typo>
                </Button>
            </View>
        );

        // --- 5. PENDING CASE ---
        if (applicationStatus === 'pending') return (
            <TouchableOpacity 
                style={[styles.statusButton, styles.cancelBtn]} 
                onPress={handleCancelRequest}
            >
                <Trash size={20} color={colors.red} weight="fill" />
                <Typo color={colors.red} fontWeight="700">Cancel Request</Typo>
            </TouchableOpacity>
        );

        // --- 6. DEFAULT CASE ---
        return (
            <Button style={styles.adoptBtn} onPress={handleAdopt} loading={adoptionLoading}>
                <Handshake size={24} color="white" weight="bold" />
                <Typo color={colors.white} fontWeight="700" size={18}>Send Adoption Request</Typo>
            </Button>
        );
    }, [isOwner, isSold, adopterData, applicationStatus, userApplication, adoptionLoading, pet, handleAdopt, handleCancelRequest, fetchingData]);

    if (!pet) return <ScreenWrapper style={styles.centered}><ActivityIndicator color={colors.primary} /></ScreenWrapper>;

    return (
        <ScreenWrapper style={styles.container}>
            <View style={styles.headerContainer}><Header title="Buddy Details" leftIcon={<BackButton />} /></View>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.imageContainer}>
                    <Image source={getPetImage(pet.image)} style={styles.mainImage} contentFit="cover" transition={300} cachePolicy="memory-disk" />
                    {isSold && <View style={styles.soldBadge}><SealCheck size={20} color="white" weight="fill" /><Typo color="white" fontWeight="700">ADOPTED</Typo></View>}
                </View>

                <View style={styles.content}>
                    <View style={styles.topMeta}>
                        <View style={styles.certifiedBadge}><SealCheck size={16} color={colors.green} weight="fill" /><Text style={styles.certifiedText}>Verified Listing</Text></View>
                        <Typo size={12} color={colors.textLighter}>{getTimeElapsed(pet.createdAt)}</Typo>
                    </View>

                    <View style={styles.titleRow}>
                        <View style={{ flex: 1 }}>
                            <Typo size={30} fontWeight="800">{pet.name}</Typo>
                            <TouchableOpacity style={styles.locationRow} onPress={() => Linking.openURL(`geo:0,0?q=${encodeURIComponent(pet.address)}`)}>
                                <MapPin size={18} color={colors.primary} weight="fill" />
                                <Text numberOfLines={1} style={styles.addressText}>{pet.address}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.categoryBox}><Typo color={colors.primary} fontWeight="700" size={13}>{pet.category}</Typo></View>
                    </View>

                    <View style={styles.grid}>
                        <InfoCard icon={<PawPrint size={22} color={colors.primary} weight="duotone" />} label="Breed" value={pet.breed} />
                        <InfoCard icon={<Calendar size={22} color={colors.primary} weight="duotone" />} label="Age" value={pet.age ? `${pet.age} Yrs` : 'Baby'} />
                        <InfoCard icon={<Palette size={22} color={colors.primary} weight="duotone" />} label="Color" value={pet.coatcolor || 'Mix'} />
                    </View>

                    <Typo size={18} fontWeight="700" style={{ marginBottom: 10 }}>Description</Typo>
                    <Typo color={colors.textLight} style={styles.descText}>{pet.description || "No specific details provided."}</Typo>

                    <View style={styles.ownerSection}>
                        <Typo size={18} fontWeight="700" style={{ marginBottom: 12 }}>Meet the Owner</Typo>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => handleThrottledAction(() => {
                            if (isOwner) router.push("/(tabs)/profile");
                            else router.push({ pathname: "/(modals)/userAnalyticsModal", params: { userId: pet.ownerId! } });
                        })} style={styles.ownerCard}>
                            <Image source={ownerData?.image ? { uri: ownerData.image } : require('../../assets/Avatar.jpg')} style={styles.ownerAvatar} cachePolicy="memory-disk" />
                            <View style={styles.ownerDetails}>
                                <Typo fontWeight="700" size={16}>{ownerData?.name || (fetchingData ? "Loading..." : "Pet Owner")}</Typo>
                                <View style={styles.roleBadge}><Typo size={10} color={colors.primary} fontWeight="800">{ownerData?.role?.toUpperCase() || 'MEMBER'}</Typo></View>
                            </View>
                            {!isOwner && !isSold && (
                                <TouchableOpacity style={styles.chatIcon} onPress={(e) => { e.stopPropagation(); handleChatPress(); }}>
                                    <ChatCircleDots size={24} color={colors.primary} weight="fill" />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                {isSold && !isOwner ? (
                    <View style={styles.unavailableFooter}><CheckCircle size={22} color={colors.textLighter} weight="fill" /><Typo color={colors.textLighter} fontWeight="700">Adopted</Typo></View>
                ) : adoptButtonSection}
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerContainer: { paddingHorizontal: spacingX._15, paddingBottom: spacingY._10 },
    scrollContent: { paddingBottom: verticalScale(140) },
    imageContainer: { marginHorizontal: spacingX._20, borderRadius: radius._20, overflow: 'hidden', borderWidth: 1, borderColor: colors.backgroundDark },
    mainImage: { width: '100%', height: verticalScale(350) },
    soldBadge: { position: 'absolute', top: 15, left: 15, backgroundColor: colors.green, paddingHorizontal: 15, paddingVertical: 8, borderRadius: radius._12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    content: { padding: spacingX._20 },
    topMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    certifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.green + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius._10 },
    certifiedText: { color: colors.green, fontSize: 11, fontWeight: '700' },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    addressText: { fontSize: 14, color: colors.primary, textDecorationLine: 'underline', fontWeight: '600' },
    categoryBox: { backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius._10 },
    grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    gridItem: { width: '31%', backgroundColor: colors.white, paddingVertical: 18, borderRadius: radius._20, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.backgroundDark },
    gridValue: { fontSize: 14, fontWeight: '800', color: colors.text },
    ownerSection: { marginTop: 25 },
    ownerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 15, borderRadius: radius._20, borderWidth: 1, borderColor: colors.backgroundDark },
    ownerAvatar: { width: 54, height: 54, borderRadius: 27 },
    ownerDetails: { flex: 1, marginLeft: 15 },
    roleBadge: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
    chatIcon: { backgroundColor: colors.primarySoft, padding: 12, borderRadius: 15 },
    descText: { lineHeight: 24, fontSize: 15, marginBottom: 20 },
    footer: { position: 'absolute', bottom: 0, width: '100%', paddingHorizontal: spacingX._20, paddingBottom: Platform.OS === 'ios' ? spacingY._35 : spacingY._20, backgroundColor: colors.background, minHeight: verticalScale(110), justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.backgroundDark, paddingVertical: 10 },
    adoptBtn: { width: '100%', height: verticalScale(56), borderRadius: radius._17, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.green, flexDirection: 'row', gap: 10 },
    resendBtn: { width: '100%', height: verticalScale(48), borderRadius: radius._15, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.text, flexDirection: 'row', gap: 8 },
    statusButton: { width: '100%', height: verticalScale(56), borderRadius: radius._17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    cancelBtn: { backgroundColor: colors.red + '10', borderWidth: 1, borderColor: colors.red },
    rejectedBadge: { backgroundColor: colors.red + '15', borderWidth: 1, borderColor: colors.red, height: verticalScale(48) },
    ownerListingInfo: { width: '100%', height: verticalScale(56), backgroundColor: colors.primarySoft, borderRadius: radius._17, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    unavailableFooter: { width: '100%', height: verticalScale(56), backgroundColor: colors.backgroundDark, borderRadius: radius._17, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    adopterPillCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 10, borderRadius: radius._20, borderWidth: 1, borderColor: colors.backgroundDark, gap: 12 },
    adopterAvatarWrapper: { position: 'relative' },
    adopterAvatar: { width: 40, height: 40, borderRadius: 20 },
    checkBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.green, borderRadius: 10, padding: 2, borderWidth: 2, borderColor: 'white' }
});

export default React.memo(PetDetailsModal);
