import React from 'react';
import { StyleSheet, View, ScrollView, Platform } from 'react-native';
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { colors, radius, spacingX, spacingY } from "@/constants/themes";
import { 
    ShieldCheck, 
    LockKey, 
    UserFocus, 
    Database, 
    CloudArrowUp,
    Scroll
} from "phosphor-react-native";
import { verticalScale } from '@/utils/styling';

const privacyPolicyModal = () => {
    return (
        <ScreenWrapper style={styles.container}>
            <Header title="Privacy Policy" leftIcon={<BackButton />} />
            
            <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={styles.scrollContent}
            >
                {/* Intro Section */}
                <View style={styles.introBox}>
                    <ShieldCheck size={40} color={colors.primary} weight="duotone" />
                    <Typo size={22} fontWeight="800" style={{ marginTop: 10 }}>Your Data is Secured</Typo>
                    <Typo color={colors.textLight} style={styles.centeredText}>
                        FurrEver is committed to protecting your personal information and your pet's data through industry-standard encryption.
                    </Typo>
                </View>

                {/* Policy Sections */}
                <PolicySection 
                    icon={<LockKey size={22} color={colors.primary} />}
                    title="Data Encryption"
                    content="All personal data, including email addresses and chat history, is encrypted in transit using SSL/TLS protocols and stored securely using Firebase AES-256 encryption."
                />

                <PolicySection 
                    icon={<CloudArrowUp size={22} color={colors.primary} />}
                    title="Storage & Compliance"
                    content="We utilize Google Cloud Infrastructure which is compliant with ISO 27001, SOC 1, SOC 2, and SOC 3. Your pet images are stored securely via Cloudinary CDN."
                />

                <PolicySection 
                    icon={<UserFocus size={22} color={colors.primary} />}
                    title="User Rights (GDPR/CCPA)"
                    content="You have the right to access, correct, or delete your personal data at any time. You can request a full data export or account deletion directly through your profile settings."
                />

                <PolicySection 
                    icon={<Database size={22} color={colors.primary} />}
                    title="Third-Party Sharing"
                    content="We do not sell your personal data. Data is only shared with essential service providers (Firebase, Cloudinary) to ensure app functionality."
                />

                <View style={styles.footer}>
                    <Scroll size={18} color={colors.textLighter} />
                    <Typo size={12} color={colors.textLighter}>
                        Last Updated: January 2026 • FurrEver v1.0
                    </Typo>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};
const PolicySection = ({ icon, title, content }: { icon: any, title: string, content: string }) => (
    <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
            {icon}
            <Typo fontWeight="700" size={16} style={{ marginLeft: 10 }}>{title}</Typo>
        </View>
        <Typo size={14} color={colors.textLight} style={styles.sectionBody}>
            {content}
        </Typo>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacingX._20,

    },
    scrollContent: {
        paddingBottom: spacingY._40,
        paddingTop: verticalScale(20),
    },
    introBox: {
        alignItems: 'center',
        marginBottom: 30,
        backgroundColor: colors.white,
        padding: 25,
        borderRadius: radius._20,
        borderWidth: 1,
        borderColor: colors.backgroundDark,
    },
    centeredText: {
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 20,
    },
    sectionCard: {
        backgroundColor: colors.white,
        padding: 20,
        borderRadius: radius._15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: colors.backgroundDark,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 8,
            },
            android: {
                elevation: 1,
            }
        })
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionBody: {
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 20,
        opacity: 0.7,
    }
});

export default React.memo(privacyPolicyModal);