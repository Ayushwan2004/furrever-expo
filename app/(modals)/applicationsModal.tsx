import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { 
    FlatList, StyleSheet, View, TouchableOpacity, 
    Platform, ActivityIndicator, Alert, InteractionManager 
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { writeBatch, doc } from 'firebase/firestore';
import { firestore } from '@/config/firebase';

import ScreenWrapper from '@/components/ScreenWrapper';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import Typo from '@/components/Typo';

import { useAdoption } from '@/contexts/AdoptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacingX, spacingY } from '@/constants/themes';
import { verticalScale, scale } from '@/utils/styling';
import { Info, UserCircle, CaretRight, Trash, Checks, Square, X } from 'phosphor-react-native';

const ApplicationCard = React.memo(({ 
    item, onAction, onUserPress, isProcessing, anyPetAlreadyApproved, 
    onLongPress, isSelected, isSelectionMode 
}: any) => {
    const isPending = item.status === 'pending';
    const isPetAlreadyTaken = isPending && anyPetAlreadyApproved;

    const handlePress = () => {
        if (isSelectionMode) {
            onLongPress(item.id); // Toggle in selection mode
        }
    };

    return (
        <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={handlePress}
            onLongPress={() => onLongPress(item.id)}
            style={[
                styles.card, 
                isPetAlreadyTaken && { opacity: 0.6 },
                isSelected && styles.cardSelected
            ]}
        >
            <View style={styles.cardHeader}>
                {isSelectionMode && (
                    <View style={styles.selectionCheck}>
                        {isSelected ? 
                            <Checks size={20} color={colors.primary} weight="bold" /> : 
                            <Square size={20} color={colors.textLighter} />
                        }
                    </View>
                )}
                <Image source={{ uri: item.petImage }} style={styles.thumb} contentFit="cover" transition={200} />
                <View style={{ flex: 1 }}>
                    <Typo fontWeight="800" size={17}>{item.petName}</Typo>
                    <TouchableOpacity 
                        onPress={() => !isSelectionMode && onUserPress(item.adopterId)} 
                        style={styles.adopterLink}
                    >
                        <UserCircle size={14} color={colors.primary} weight="fill" />
                        <Typo size={13} color={colors.primary} fontWeight="700"> {item.adopterName}</Typo>
                        {!isSelectionMode && <CaretRight size={10} color={colors.primary} weight="bold" />}
                    </TouchableOpacity>
                </View>

                <View style={[
                    styles.statusBadge, 
                    { backgroundColor: item.status === 'approved' ? colors.green + '15' : item.status === 'rejected' ? colors.red + '15' : colors.primary + '15' }
                ]}>
                    <Typo size={10} fontWeight="900" color={item.status === 'approved' ? colors.green : item.status === 'rejected' ? colors.red : colors.primary}>
                        {item.status.toUpperCase()}
                    </Typo>
                </View>
            </View>

            {isPending && !isSelectionMode && (
                <View style={styles.actions}>
                    {isPetAlreadyTaken ? (
                        <View style={styles.takenNotice}>
                            <Info size={16} color={colors.textLighter} weight="duotone" />
                            <Typo size={12} color={colors.textLighter} fontWeight="600">Buddy found a home.</Typo>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity style={[styles.actionBtn, styles.rejBtn]} onPress={() => onAction(item.id, item.petId, 'rejected')} disabled={isProcessing}>
                                <Typo color="white" size={14} fontWeight="700">Reject</Typo>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, styles.accBtn]} onPress={() => onAction(item.id, item.petId, 'approved')} disabled={isProcessing}>
                                {isProcessing ? <ActivityIndicator color="white" size="small" /> : <Typo color="white" size={14} fontWeight="700">Approve</Typo>}
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
});

const ApplicationsModal = () => {
    const { applications, updateApplicationStatus } = useAdoption();
    const { user } = useAuth();
    const router = useRouter();
    
    const [actionId, setActionId] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isClearing, setIsClearing] = useState(false);
    const interactionLock = useRef(false);

    useEffect(() => { InteractionManager.runAfterInteractions(() => setIsReady(true)); }, []);

    const received = useMemo(() => applications.filter(app => app.ownerId === user?.uid), [applications, user?.uid]);
    const approvedPetIds = useMemo(() => new Set(received.filter(a => a.status === 'approved').map(a => a.petId)), [received]);
    
    // Only Non-Pending can be cleared
    const clearable = useMemo(() => received.filter(app => app.status !== 'pending'), [received]);
    const isSelectionMode = selectedIds.size > 0;

    const toggleSelection = useCallback((id: string) => {
        Haptics.selectionAsync();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else {
                // Prevent selecting pending items for deletion
                const item = received.find(r => r.id === id);
                if (item?.status === 'pending') {
                    Alert.alert("Notice", "Active requests cannot be cleared. Please Approve or Reject them first.");
                    return prev;
                }
                next.add(id);
            }
            return next;
        });
    }, [received]);

    const handleClearSelected = async () => {
        if (selectedIds.size === 0 || isClearing) return;
        
        Alert.alert("Clear Selected", `Remove ${selectedIds.size} records?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Clear", style: "destructive", onPress: async () => {
                setIsClearing(true);
                try {
                    const batch = writeBatch(firestore);
                    selectedIds.forEach(id => batch.delete(doc(firestore, "adoptions", id)));
                    await batch.commit();
                    setSelectedIds(new Set());
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } finally { setIsClearing(false); }
            }}
        ]);
    };

    const handleClearAllResolved = async () => {
        if (clearable.length === 0 || isClearing) return;
        Alert.alert("Clear All Resolved", `Remove all ${clearable.length} completed requests?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Clear All", style: "destructive", onPress: async () => {
                setIsClearing(true);
                const batch = writeBatch(firestore);
                clearable.forEach(req => batch.delete(doc(firestore, "adoptions", req.id)));
                await batch.commit();
                setIsClearing(false);
            }}
        ]);
    };

    const handleUserPress = useCallback((uid: string) => {
        if (interactionLock.current) return;
        interactionLock.current = true;
        router.push({ pathname: "/(modals)/userAnalyticsModal", params: { userId: uid } });
        setTimeout(() => { interactionLock.current = false; }, 800);
    }, []);

    const handleAction = useCallback(async (id: string, petId: string, status: any) => {
        if (actionId) return;
        Alert.alert(status === 'approved' ? "Approve?" : "Reject?", "Confirm this decision.", [
            { text: "No", style: "cancel" },
            { text: "Yes", onPress: async () => {
                setActionId(id);
                await updateApplicationStatus(id, petId, status);
                setActionId(null);
            }}
        ]);
    }, [updateApplicationStatus, actionId]);

    if (!isReady) return <ScreenWrapper style={styles.container}><Header title="Requests" leftIcon={<BackButton />} /><View style={styles.centered}><ActivityIndicator color={colors.primary} /></View></ScreenWrapper>;

    return (
        <ScreenWrapper style={styles.container}>
            <Header 
                title={isSelectionMode ? `${selectedIds.size} Selected` : "Requests"} 
                leftIcon={isSelectionMode ? 
                    <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={styles.headerIcon}><X size={24} color={colors.text} /></TouchableOpacity> : 
                    <BackButton />
                }
                rightIcon={
                    isSelectionMode ? (
                        <TouchableOpacity onPress={handleClearSelected} disabled={isClearing} style={styles.headerIcon}>
                            {isClearing ? <ActivityIndicator size="small" color={colors.red} /> : <Trash size={22} color={colors.red} weight="fill" />}
                        </TouchableOpacity>
                    ) : (
                        clearable.length > 0 && (
                            <TouchableOpacity onPress={handleClearAllResolved} style={styles.headerIcon}>
                                <Checks size={22} color={colors.primary} weight="bold" />
                            </TouchableOpacity>
                        )
                    )
                }
            />
            
            <FlatList
                data={received}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <ApplicationCard 
                        item={item} 
                        onAction={handleAction} 
                        onUserPress={handleUserPress}
                        onLongPress={toggleSelection}
                        isSelected={selectedIds.has(item.id)}
                        isSelectionMode={isSelectionMode}
                        isProcessing={actionId === item.id} 
                        anyPetAlreadyApproved={approvedPetIds.has(item.petId)} 
                    />
                )}
                ListEmptyComponent={<View style={styles.emptyState}><Info size={40} color={colors.backgroundDark} weight="duotone" /><Typo color={colors.textLighter}>No requests found.</Typo></View>}
                removeClippedSubviews={true} initialNumToRender={8} windowSize={5}
            />
        </ScreenWrapper>
    );
};

export default React.memo(ApplicationsModal);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: Platform.OS === 'ios' ? spacingX._20 : spacingX._20  },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: {  paddingTop: spacingY._15, paddingBottom: 50, gap: spacingY._15 },
    card: { backgroundColor: colors.white, padding: scale(16), borderRadius: radius._20, borderWidth: 1, borderColor: colors.backgroundDark },
    cardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft + '10', borderWidth: 2 },
    cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    selectionCheck: { marginRight: 4 },
    thumb: { width: verticalScale(58), height: verticalScale(58), borderRadius: radius._15, backgroundColor: colors.backgroundDark },
    adopterLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius._10 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 16, borderTopWidth: 1, borderTopColor: colors.backgroundDark, paddingTop: 16 },
    actionBtn: { flex: 1, height: verticalScale(44), borderRadius: radius._12, justifyContent: 'center', alignItems: 'center' },
    accBtn: { backgroundColor: colors.green }, 
    rejBtn: { backgroundColor: colors.red },   
    takenNotice: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundDark + '30', padding: 12, borderRadius: radius._12, gap: 6 },
    emptyState: { marginTop: verticalScale(140), alignItems: 'center', justifyContent: 'center' },
    headerIcon: { padding: 8 }
});