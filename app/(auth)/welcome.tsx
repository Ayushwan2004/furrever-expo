import React, { useCallback, useRef, useEffect, memo } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View, InteractionManager } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import Button from '@/components/Button';
import ScreenWrapper from '@/components/ScreenWrapper';
import Typo from '@/components/Typo';
import { colors, spacingX, spacingY, radius } from '@/constants/themes';
import { verticalScale } from '@/utils/styling';

const Welcome = () => {
  const router = useRouter();
  const isNavigating = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const navigateSafely = useCallback((path: string) => {
    if (isNavigating.current || !isMounted.current) return;
    isNavigating.current = true;

    // Safety: Wait for any active layout animations to settle
    InteractionManager.runAfterInteractions(() => {
        if (!isMounted.current) return;
        router.push(path as any);
        
        // Lock for 800ms to prevent double-tap crashes
        setTimeout(() => { 
            if (isMounted.current) isNavigating.current = false; 
        }, 800);
    });
  }, [router]);

  return (
    <ScreenWrapper style={{ backgroundColor: colors.background }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigateSafely('/(tabs)')} style={styles.guestButton}>
            <Typo fontWeight="700" color={colors.primaryDark}>Skip</Typo>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateSafely('/(auth)/login')} style={styles.loginButton}>
            <Typo fontWeight="800" size={18} color={colors.text}>Sign in</Typo>
          </TouchableOpacity>
        </View>

        <Animated.Image entering={FadeIn.duration(1000).springify()} source={require('../../assets/welcomeImage.png')} style={styles.welcomeImage} resizeMode='contain' />

        <View style={styles.footer}>
          <Animated.View entering={FadeInDown.duration(800).springify()}>
            <Typo size={32} fontWeight="800" style={styles.title}>Make adoption easier & trusted</Typo>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.subtextContainer}>
            <Typo size={17} color={colors.textLight} style={styles.textCenter}>Your Furry Buddy is one step away.</Typo>
            <Typo size={17} color={colors.textLight} style={styles.textCenter}>Get verified and authentic pets.</Typo>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.buttonContainer}>
            <Button onPress={() => navigateSafely('/(auth)/register')}>
              <Typo size={20} color={colors.white} fontWeight="700">Get Started</Typo>
            </Button>
          </Animated.View>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default memo(Welcome);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between" },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacingX._20, paddingTop: spacingY._10 },
  guestButton: { paddingVertical: 8, paddingHorizontal: 15, backgroundColor: colors.primarySoft, borderRadius: radius._30 },
  loginButton: { paddingVertical: 8 },
  welcomeImage: { width: "100%", height: verticalScale(350), alignSelf: "center" },
  footer: { backgroundColor: colors.white, borderTopLeftRadius: radius._30, borderTopRightRadius: radius._30, paddingTop: verticalScale(30), paddingBottom: verticalScale(45), paddingHorizontal: spacingX._25, gap: spacingY._20, ...Platform.select({ ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20 }, android: { elevation: 15 } }) },
  title: { textAlign: 'center', lineHeight: 38 },
  subtextContainer: { gap: 2 },
  textCenter: { textAlign: 'center' },
  buttonContainer: { width: '100%', marginTop: spacingY._10 },
});