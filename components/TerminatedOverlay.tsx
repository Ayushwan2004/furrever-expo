import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Linking, StatusBar, Modal,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius } from '@/constants/themes';
import { scale, verticalScale } from '@/utils/styling';

function FloatingPet({ emoji, style }: { emoji: string; style: any }) {
  const float = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -12, duration: 2200, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotate, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: -1, duration: 3000, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const rotateInterp = rotate.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] });
  return (
    <Animated.Text style={[style, { transform: [{ translateY: float }, { rotate: rotateInterp }] }]}>
      {emoji}
    </Animated.Text>
  );
}

export default function TerminatedOverlay() {
  const { user, logout, terminatedOnLogin, clearTerminatedOnLogin } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Case 1 & 2: signed in but account is terminated (real-time via onSnapshot)
    const isTerminated = user && (user as any).adminStatus === 'terminated';
    if (isTerminated) {
      setVisible(true);
    } else if (!terminatedOnLogin) {
      // Only hide if not showing due to a login attempt
      setVisible(false);
    }
  }, [user, terminatedOnLogin]);

  useEffect(() => {
    // Case 3: tried to sign in but account was terminated
    if (terminatedOnLogin) setVisible(true);
  }, [terminatedOnLogin]);

  const handleContactUs = () => {
    Linking.openURL('https://furrever.netlify.app/contact');
  };

  const handleSignOut = async () => {
    setVisible(false);
    clearTerminatedOnLogin();
    await logout();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => { }}
      hardwareAccelerated
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

        <FloatingPet emoji="🐶" style={[styles.bgPet, { top: '8%', left: '5%', fontSize: scale(42), opacity: 0.07 }]} />
        <FloatingPet emoji="🐱" style={[styles.bgPet, { top: '12%', right: '8%', fontSize: scale(36), opacity: 0.07 }]} />
        <FloatingPet emoji="🐾" style={[styles.bgPet, { top: '35%', left: '3%', fontSize: scale(28), opacity: 0.06 }]} />
        <FloatingPet emoji="🐶" style={[styles.bgPet, { bottom: '25%', right: '5%', fontSize: scale(32), opacity: 0.07 }]} />
        <FloatingPet emoji="🐱" style={[styles.bgPet, { bottom: '18%', left: '8%', fontSize: scale(38), opacity: 0.06 }]} />
        <FloatingPet emoji="🐾" style={[styles.bgPet, { top: '55%', right: '4%', fontSize: scale(24), opacity: 0.05 }]} />
        <FloatingPet emoji="🦴" style={[styles.bgPet, { top: '70%', left: '12%', fontSize: scale(22), opacity: 0.06 }]} />
        <FloatingPet emoji="🐟" style={[styles.bgPet, { bottom: '10%', right: '15%', fontSize: scale(26), opacity: 0.05 }]} />

        <View style={styles.card}>
          <View style={styles.iconCluster}>
            <Text style={styles.mainIcon}>🚫</Text>
            <View style={styles.petBadgeRow}>
              <Text style={styles.petBadge}>🐶</Text>
              <Text style={styles.petBadge}>🐱</Text>
            </View>
          </View>

          <Text style={styles.brand}>🐾 Furr<Text style={{ color: colors.primary }}>Ever</Text></Text>
          <Text style={styles.title}>Account Suspended</Text>
          <View style={styles.divider} />

          <Text style={styles.message}>
            Your FurrEver account has been suspended by our moderation team for violating our{' '}
            <Text style={styles.bold}>Community Guidelines</Text>.
          </Text>

          <Text style={styles.subMessage}>
            If you believe this is a mistake or need more information, our support team is here to help.
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              Suspensions are reviewed case-by-case. Repeated violations may result in a permanent ban.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleContactUs} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Contact Support →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSignOut} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={styles.urlHint}>https://furrever.netlify.app/contact</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(24),
  },
  bgPet: { position: 'absolute', zIndex: 0 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius._20,
    padding: scale(28),
    width: '100%',
    maxWidth: scale(380),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.backgroundDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 10,
  },
  iconCluster: { alignItems: 'center', marginBottom: verticalScale(8) },
  mainIcon: { fontSize: scale(52), marginBottom: verticalScale(4) },
  petBadgeRow: { flexDirection: 'row', gap: scale(6), marginTop: verticalScale(2) },
  petBadge: { fontSize: scale(22), opacity: 0.5 },
  brand: { fontSize: scale(20), fontWeight: '900', color: colors.text, marginBottom: verticalScale(12), letterSpacing: -0.5 },
  title: { fontSize: scale(22), fontWeight: '900', color: colors.red, textAlign: 'center', marginBottom: verticalScale(12) },
  divider: { width: '40%', height: 3, backgroundColor: colors.backgroundDark, borderRadius: 99, marginBottom: verticalScale(16) },
  message: { fontSize: scale(14), color: colors.textLight, textAlign: 'center', lineHeight: scale(22), marginBottom: verticalScale(10) },
  bold: { fontWeight: '800', color: colors.text },
  subMessage: { fontSize: scale(13), color: colors.textLighter, textAlign: 'center', lineHeight: scale(20), marginBottom: verticalScale(16) },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(8), backgroundColor: colors.backgroundDark, borderRadius: radius._12, padding: scale(14), marginBottom: verticalScale(20), borderLeftWidth: 3, borderLeftColor: colors.primary },
  infoIcon: { fontSize: scale(16) },
  infoText: { flex: 1, fontSize: scale(12), color: colors.textLight, lineHeight: scale(18), fontWeight: '600' },
  primaryBtn: { width: '100%', backgroundColor: colors.primary, paddingVertical: verticalScale(14), borderRadius: radius._30, alignItems: 'center', marginBottom: verticalScale(10), shadowColor: colors.primaryDark, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  primaryBtnText: { fontSize: scale(15), fontWeight: '800', color: colors.text, letterSpacing: 0.3 },
  secondaryBtn: { width: '100%', borderWidth: 2, borderColor: colors.backgroundDark, paddingVertical: verticalScale(12), borderRadius: radius._30, alignItems: 'center', marginBottom: verticalScale(14) },
  secondaryBtnText: { fontSize: scale(14), fontWeight: '700', color: colors.textLighter },
  urlHint: { fontSize: scale(11), color: colors.textLighter, textDecorationLine: 'underline', fontWeight: '600' },
});