import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    StyleSheet, View, FlatList, ActivityIndicator, 
    TouchableOpacity, Platform, Alert, InteractionManager
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { 
    collection, query, where, getDocs, 
    addDoc, serverTimestamp, doc, getDoc 
} from 'firebase/firestore';
import { DownloadSimple, PawPrint, SealCheck } from "phosphor-react-native";

import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { firestore } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useAdoption } from '@/contexts/AdoptionContext';
import { useCertificate } from "@/contexts/certificationContext";
import { colors, radius, spacingX, spacingY } from "@/constants/themes";
import { CertificateType, AdoptionType, PetType } from '@/types';

const AdoptionHistoryModal = () => {
    const { user } = useAuth();
    const { applications, loading: adoptionsLoading } = useAdoption();
    const { downloadPDF } = useCertificate();
    
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false); // New state for animation guard
    const isMounted = useRef(true);
    const actionLock = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        // Animation Guard: Wait for modal to finish sliding up
        InteractionManager.runAfterInteractions(() => {
            if (isMounted.current) setIsReady(true);
        });
        return () => { isMounted.current = false; };
    }, []);

    const approvedAdoptions = useMemo(() => {
        return applications.filter(app => 
            app.status === 'approved' && app.adopterId === user?.uid
        );
    }, [applications, user?.uid]);

    const handleDownloadAction = async (adoption: AdoptionType) => {
        if (actionLock.current || generatingId) return;
        
        try {
            actionLock.current = true;
            setGeneratingId(adoption.id);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const petSnap = await getDoc(doc(firestore, "pets", adoption.petId));
            
            if (!isMounted.current) return;
            if (!petSnap.exists()) {
                Alert.alert("Notice", "Detailed pet records are no longer available.");
                return;
            }
            const petData = petSnap.data() as PetType;

            const certQuery = query(
                collection(firestore, "certificates"),
                where("adoptionId", "==", adoption.id)
            );
            const certSnap = await getDocs(certQuery);
            
            if (!isMounted.current) return;

            let certificateData: CertificateType;

            if (certSnap.empty) {
                const uniqueId = `FE-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
                const newCert: any = {
                    certificateId: uniqueId,
                    adoptionId: adoption.id,
                    petId: adoption.petId,
                    petName: petData.name,
                    petImage: petData.image,
                    adopterId: user?.uid,
                    adopterName: user?.name,
                    breed: petData.breed || "Purebreed",
                    category: petData.category || "Pet",
                    color: petData.coatcolor || "Standard", 
                    age: petData.age || "Unknown",         
                    issuedAt: serverTimestamp(),
                };

                const docRef = await addDoc(collection(firestore, "certificates"), newCert);
                certificateData = { ...newCert, id: docRef.id, issuedAt: { toDate: () => new Date() } };
            } else {
                certificateData = { id: certSnap.docs[0].id, ...certSnap.docs[0].data() } as CertificateType;
            }

            await downloadPDF(certificateData);
            
            if (isMounted.current) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

        } catch (error) {
            console.error("PDF Generation Error:", error);
            Alert.alert("Error", "Failed to generate certificate.");
        } finally {
            if (isMounted.current) {
                setGeneratingId(null);
                actionLock.current = false;
            }
        }
    };

    // UI Skeleton/Loader while animating
    if (!isReady || adoptionsLoading) {
        return (
            <ScreenWrapper style={styles.container}>
                <Header title="My Records" leftIcon={<BackButton />} />
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper style={styles.container}>
            <Header title="My Records" leftIcon={<BackButton />} />
            
            <FlatList
                data={approvedAdoptions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={8}
                maxToRenderPerBatch={5}
                windowSize={10}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Image 
                            source={{ uri: item.petImage }} 
                            style={styles.petThumb} 
                            contentFit="cover" 
                            transition={200} 
                        />
                        <View style={styles.details}>
                            <Typo fontWeight="800" size={18}>{item.petName}</Typo>
                            <View style={styles.statusBadge}>
                                <SealCheck size={14} color={colors.green} weight="fill" />
                                <Typo size={12} color={colors.green} fontWeight="700"> Official Record</Typo>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={styles.downloadBtn} 
                            onPress={() => handleDownloadAction(item)}
                            activeOpacity={0.6}
                        >
                            {generatingId === item.id ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : (
                                <DownloadSimple size={22} color="white" weight="bold" />
                            )}
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={<EmptyState />}
            />
        </ScreenWrapper>
    );
};

const EmptyState = () => (
    <View style={styles.emptyContainer}>
        <View style={styles.emptyCircle}>
            <PawPrint size={40} color={colors.backgroundDark} weight="duotone" />
        </View>
        <Typo size={18} fontWeight="700" color={colors.textLight}>No records found</Typo>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: Platform.OS === 'ios' ? spacingX._20 : spacingX._20   },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: {  paddingBottom: spacingY._30, paddingTop: 10 },
    card: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
        padding: 15, borderRadius: radius._20, marginBottom: 15,
        borderWidth: 1, borderColor: colors.backgroundDark,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
            android: { elevation: 2 },
        }),
    },
    petThumb: { width: 60, height: 60, borderRadius: radius._12, backgroundColor: colors.backgroundDark },
    details: { flex: 1, marginLeft: 15, justifyContent: 'center' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    downloadBtn: { width: 44, height: 44, backgroundColor: colors.primary, borderRadius: radius._12, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
    emptyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.backgroundDark, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
});

export default React.memo(AdoptionHistoryModal);