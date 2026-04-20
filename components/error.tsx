// app/error.tsx
// Shown when Firebase/network is unreachable
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { enableNetwork } from 'firebase/firestore';
import { firestore } from '@/config/firebase';
import { colors, radius } from '@/constants/themes';
import { scale, verticalScale } from '@/utils/styling';

const { width } = Dimensions.get('window');

// ─── Animated confused dog SVG-style built with RN primitives ─────────────────
function ConfusedDog() {
  const wobble = useRef(new Animated.Value(0)).current;
  const questionFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Head wobble
    Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: -8, duration: 600, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 8, duration: 600, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -5, duration: 400, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(800),
      ])
    ).start();

    // Question mark float
    Animated.loop(
      Animated.sequence([
        Animated.timing(questionFloat, { toValue: -10, duration: 700, useNativeDriver: true }),
        Animated.timing(questionFloat, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const rotate = wobble.interpolate({ inputRange: [-8, 8], outputRange: ['-8deg', '8deg'] });

  return (
    <View style={dog.container}>
      {/* Floating question marks */}
      <Animated.Text style={[dog.questionMark, dog.q1, { transform: [{ translateY: questionFloat }] }]}>?</Animated.Text>
      <Animated.Text style={[dog.questionMark, dog.q2, { transform: [{ translateY: questionFloat }], opacity: 0.6 }]}>?</Animated.Text>

      {/* Dog body */}
      <Animated.View style={[dog.dogWrap, { transform: [{ rotate }] }]}>
        {/* Ears */}
        <View style={dog.earLeft} />
        <View style={dog.earRight} />

        {/* Head */}
        <View style={dog.head}>
          {/* Eyes — one normal, one squinting (confused) */}
          <View style={dog.eyeRow}>
            <View style={dog.eye} />
            {/* Squinting eye */}
            <View style={dog.eyeSquint}>
              <View style={dog.squintLine} />
            </View>
          </View>

          {/* Nose */}
          <View style={dog.nose} />

          {/* Confused mouth */}
          <View style={dog.mouthWrap}>
            <View style={dog.mouthLeft} />
            <View style={dog.mouthRight} />
          </View>

          {/* Eyebrow raised on one side */}
          <View style={[dog.eyebrow, dog.eyebrowLeft]} />
          <View style={[dog.eyebrow, dog.eyebrowRight, { transform: [{ rotate: '-15deg' }] }]} />
        </View>

        {/* Body */}
        <View style={dog.body}>
          {/* Paws */}
          <View style={dog.pawLeft} />
          <View style={dog.pawRight} />
          {/* Belly dot */}
          <View style={dog.belly} />
        </View>

        {/* Tail */}
        <View style={dog.tail} />
      </Animated.View>

      {/* Signal bars (broken wifi) */}
      <View style={dog.wifiWrap}>
        <View style={[dog.wifiBar, { height: 8, opacity: 0.3 }]} />
        <View style={[dog.wifiBar, { height: 14, opacity: 0.3 }]} />
        <View style={[dog.wifiBar, { height: 20, opacity: 0.3 }]} />
        <Text style={dog.wifiX}>✕</Text>
      </View>
    </View>
  );
}

const dog = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', height: verticalScale(220) },
  dogWrap: { alignItems: 'center' },
  earLeft: { position: 'absolute', top: -8, left: scale(32), width: scale(28), height: scale(36), backgroundColor: colors.primaryDark, borderRadius: scale(14), transform: [{ rotate: '-15deg' }], zIndex: 0 },
  earRight: { position: 'absolute', top: -8, right: scale(32), width: scale(28), height: scale(36), backgroundColor: colors.primaryDark, borderRadius: scale(14), transform: [{ rotate: '15deg' }], zIndex: 0 },
  head: { width: scale(110), height: scale(100), backgroundColor: colors.primary, borderRadius: scale(50), alignItems: 'center', justifyContent: 'center', zIndex: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  eyeRow: { flexDirection: 'row', gap: scale(18), marginBottom: verticalScale(6), marginTop: verticalScale(-8) },
  eye: { width: scale(14), height: scale(14), borderRadius: scale(7), backgroundColor: '#1b1a18' },
  eyeSquint: { width: scale(14), height: scale(14), justifyContent: 'center' },
  squintLine: { width: scale(14), height: 3, backgroundColor: '#1b1a18', borderRadius: 2 },
  eyebrow: { position: 'absolute', top: verticalScale(18), height: 3, width: scale(16), backgroundColor: '#1b1a18', borderRadius: 2 },
  eyebrowLeft: { left: scale(20), transform: [{ rotate: '10deg' }] },
  eyebrowRight: { right: scale(20) },
  nose: { width: scale(18), height: scale(12), backgroundColor: '#1b1a18', borderRadius: scale(9), marginBottom: verticalScale(4) },
  mouthWrap: { flexDirection: 'row' },
  mouthLeft: { width: scale(12), height: scale(6), borderBottomLeftRadius: scale(8), borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#1b1a18', transform: [{ rotate: '10deg' }] },
  mouthRight: { width: scale(12), height: scale(6), borderBottomRightRadius: scale(8), borderRightWidth: 2, borderBottomWidth: 2, borderColor: '#1b1a18', transform: [{ rotate: '-10deg' }] },
  body: { width: scale(90), height: scale(70), backgroundColor: colors.primary, borderRadius: scale(30), marginTop: -scale(10), alignItems: 'center', zIndex: 0 },
  pawLeft: { position: 'absolute', bottom: -8, left: scale(10), width: scale(22), height: scale(18), backgroundColor: colors.primaryDark, borderRadius: scale(11) },
  pawRight: { position: 'absolute', bottom: -8, right: scale(10), width: scale(22), height: scale(18), backgroundColor: colors.primaryDark, borderRadius: scale(11) },
  belly: { width: scale(40), height: scale(40), backgroundColor: colors.primaryLight, borderRadius: scale(20), marginTop: scale(12), opacity: 0.5 },
  tail: { position: 'absolute', right: -scale(20), top: scale(40), width: scale(12), height: scale(40), backgroundColor: colors.primaryDark, borderRadius: scale(8), transform: [{ rotate: '30deg' }] },
  questionMark: { position: 'absolute', fontSize: scale(32), fontWeight: '900', color: colors.primary, zIndex: 10 },
  q1: { top: 0, right: scale(20) },
  q2: { top: scale(20), left: scale(10), fontSize: scale(22) },
  wifiWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: scale(4), marginTop: verticalScale(16) },
  wifiBar: { width: scale(8), backgroundColor: colors.textLighter, borderRadius: 3 },
  wifiX: { fontSize: scale(16), color: colors.red, fontWeight: '900', marginLeft: scale(4) },
});

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function ErrorScreen() {
  const router = useRouter();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleRetry = async () => {
    try {
      await enableNetwork(firestore);
    } catch { /* silent */ }
    router.replace('/(auth)/welcome' as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Background paw prints */}
      {['🐾', '🐾', '🐾', '🐾'].map((p, i) => (
        <Text key={i} style={[styles.bgPaw, {
          top: `${15 + i * 20}%` as any,
          left: i % 2 === 0 ? `${5 + i * 8}%` as any : undefined,
          right: i % 2 !== 0 ? `${5 + i * 6}%` as any : undefined,
          opacity: 0.04 + i * 0.01,
          fontSize: scale(30 + i * 8),
        }]}>{p}</Text>
      ))}

      <Animated.View style={[styles.card, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        {/* Brand */}
        <Text style={styles.brand}>🐾 Furr<Text style={{ color: colors.primary }}>Ever</Text></Text>

        {/* Confused dog illustration */}
        <ConfusedDog />

        {/* Message */}
        <Text style={styles.title}>Uh oh... I'm lost! 🐕</Text>
        <Text style={styles.subtitle}>
          It seems we ran into some trouble connecting.{'\n'}
          Check your internet and try again.
        </Text>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>📡</Text>
          <Text style={styles.infoText}>
            Make sure you're connected to WiFi or mobile data.
          </Text>
        </View>

        {/* Retry button */}
        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.85}>
          <Text style={styles.retryText}>Try Again →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
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
  bgPaw: { position: 'absolute', zIndex: 0 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius._20,
    padding: scale(28),
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.backgroundDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    zIndex: 10,
  },
  brand: {
    fontSize: scale(20),
    fontWeight: '900',
    color: colors.text,
    marginBottom: verticalScale(8),
    letterSpacing: -0.5,
  },
  title: {
    fontSize: scale(22),
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginTop: verticalScale(8),
    marginBottom: verticalScale(10),
  },
  subtitle: {
    fontSize: scale(14),
    color: colors.textLighter,
    textAlign: 'center',
    lineHeight: scale(22),
    marginBottom: verticalScale(16),
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: colors.backgroundDark,
    borderRadius: radius._12,
    padding: scale(14),
    marginBottom: verticalScale(20),
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    width: '100%',
  },
  infoIcon: { fontSize: scale(18) },
  infoText: {
    flex: 1,
    fontSize: scale(12),
    color: colors.textLight,
    lineHeight: scale(18),
    fontWeight: '600',
  },
  retryBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: verticalScale(14),
    borderRadius: radius._30,
    alignItems: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  retryText: {
    fontSize: scale(15),
    fontWeight: '800',
    color: colors.text,
  },
});