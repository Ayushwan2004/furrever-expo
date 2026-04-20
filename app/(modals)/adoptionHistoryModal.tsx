import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    StyleSheet, View, FlatList, ActivityIndicator,
    TouchableOpacity, Platform, Alert, InteractionManager,
    Linking,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { DownloadSimple, PawPrint, SealCheck, QrCode } from "phosphor-react-native";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { firestore } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useAdoption } from '@/contexts/AdoptionContext';
import { useCertificate } from "@/contexts/certificationContext";
import { buildQrImgUrl, buildVerifyUrl } from "@/contexts/certificationContext";
import { colors, radius, spacingX, spacingY } from "@/constants/themes";
import { CertificateType, AdoptionType, PetType } from '@/types';
import { verticalScale } from '@/utils/styling';

// ─── QR Preview Card ──────────────────────────────────────────────────────────
// Shows the dynamic QR code inline on the card. Tapping opens the verify URL.
const QrPreview = ({ serialCode }: { serialCode: string }) => {
    const qrUrl     = buildQrImgUrl(serialCode, 300);
    const verifyUrl = buildVerifyUrl(serialCode);

    return (
        <TouchableOpacity
            style={styles.qrWrapper}
            activeOpacity={0.75}
            onPress={() => Linking.openURL(verifyUrl)}
        >
            <Image
                source={{ uri: qrUrl }}
                style={styles.qrImage}
                contentFit="contain"
                cachePolicy="memory-disk"
            />
            <Typo size={9} color={colors.textLighter} fontWeight="700" style={styles.qrLabel}>
                Scan to verify
            </Typo>
        </TouchableOpacity>
    );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const AdoptionHistoryModal = () => {
    const { user } = useAuth();
    const { applications, loading: adoptionsLoading } = useAdoption();
    const { downloadPDF } = useCertificate();

    const [generatingId, setGeneratingId]   = useState<string | null>(null);
    // Map of adoptionId → resolved CertificateType so QR shows immediately after first gen
    const [certMap, setCertMap]             = useState<Record<string, CertificateType>>({});
    const [isReady, setIsReady]             = useState(false);
    const isMounted   = useRef(true);
    const actionLock  = useRef(false);

    useEffect(() => {
        isMounted.current = true;
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

    // Pre-load existing certificates so QR codes show without pressing download
    useEffect(() => {
        if (!isReady || approvedAdoptions.length === 0) return;

        approvedAdoptions.forEach(async (adoption) => {
            try {
                const certRef  = doc(firestore, "certificates", adoption.petId);
                const certSnap = await getDoc(certRef);
                if (certSnap.exists() && isMounted.current) {
                    setCertMap(prev => ({
                        ...prev,
                        [adoption.id]: { id: certSnap.id, ...certSnap.data() } as CertificateType,
                    }));
                }
            } catch { /* silent — QR just won't show until first download */ }
        });
    }, [isReady, approvedAdoptions.length]);

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

            // Use petId as document ID — deterministic, no duplicates
            const certRef  = doc(firestore, "certificates", adoption.petId);
            const certSnap = await getDoc(certRef);
            if (!isMounted.current) return;

            let certificateData: CertificateType;

            if (!certSnap.exists()) {
                const newCert: Omit<CertificateType, 'id'> = {
                    serialCode:  `CERT-${adoption.petId}`,
                    petId:       adoption.petId,
                    petName:     petData.name,
                    petImage:    petData.image,
                    adopterId:   user?.uid ?? '',
                    adopterName: user?.name ?? '',
                    breed:       petData.breed    || "Purebreed",
                    category:    petData.category || "Pet",
                    color:       petData.coatcolor || "Standard",
                    age:         petData.age      || "Unknown",
                    issuedAt:    serverTimestamp(),
                    issuedBy:    'system',
                    version:     1,
                    status:      'active',
                };
                await setDoc(certRef, newCert);
                certificateData = {
                    ...newCert,
                    id: adoption.petId,
                    issuedAt: { toDate: () => new Date() },
                };
            } else {
                certificateData = { id: certSnap.id, ...certSnap.data() } as CertificateType;
            }

            // Cache so QR renders immediately in UI
            if (isMounted.current) {
                setCertMap(prev => ({ ...prev, [adoption.id]: certificateData }));
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
                renderItem={({ item }) => {
                    const cert = certMap[item.id];
                    return (
                        <View style={styles.card}>
                            {/* Pet thumbnail */}
                            <Image
                                source={{ uri: item.petImage }}
                                style={styles.petThumb}
                                contentFit="cover"
                                transition={200}
                            />

                            {/* Details + QR */}
                            <View style={styles.details}>
                                <Typo fontWeight="800" size={17}>{item.petName}</Typo>
                                <View style={styles.statusBadge}>
                                    <SealCheck size={13} color={colors.green} weight="fill" />
                                    <Typo size={11} color={colors.green} fontWeight="700"> Official Record</Typo>
                                </View>

                                {cert ? (
                                    /* QR visible once cert is resolved */
                                    <QrPreview serialCode={cert.serialCode} />
                                ) : (
                                    /* Placeholder hint before first download */
                                    <View style={styles.qrPlaceholder}>
                                        <QrCode size={16} color={colors.textLighter} weight="duotone" />
                                        <Typo size={9} color={colors.textLighter} style={{ marginLeft: 4 }}>
                                            Download to activate QR
                                        </Typo>
                                    </View>
                                )}
                            </View>

                            {/* Download button */}
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
                    );
                }}
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
    container:   { flex: 1, backgroundColor: colors.background, padding: spacingX._20 },
    centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingBottom: spacingY._30, paddingTop: 10 },

    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        padding: 14,
        borderRadius: radius._20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: colors.backgroundDark,
        gap: 12,
        ...Platform.select({
            ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
            android: { elevation: 2 },
        }),
    },

    petThumb:    { width: 64, height: 64, borderRadius: radius._12, backgroundColor: colors.backgroundDark },

    details:     { flex: 1, justifyContent: 'center', gap: 5 },
    statusBadge: { flexDirection: 'row', alignItems: 'center' },

    // QR preview
    qrWrapper: {
        alignItems: 'center',
        marginTop: 6,
        alignSelf: 'flex-start',
    },
    qrImage: {
        width: verticalScale(64),
        height: verticalScale(64),
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.backgroundDark,
        backgroundColor: '#fff',
    },
    qrLabel: { marginTop: 2, textAlign: 'center' },

    qrPlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        backgroundColor: colors.backgroundDark,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },

    downloadBtn:    { width: 44, height: 44, backgroundColor: colors.primary, borderRadius: radius._12, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
    emptyCircle:    { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.backgroundDark, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
});

export default React.memo(AdoptionHistoryModal);