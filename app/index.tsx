import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '../constants/themes';

const RootIndex = () => {
  const { user, initialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    if (user?.emailVerified) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [initialized, user]);

  return (
    <View style={styles.container}>
      <Image 
        contentFit='contain' 
        style={styles.logo}
        source={require('../assets/Logo.jpeg')}
        transition={300}
      />
    </View>
  );
};

export default RootIndex;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  logo: {
    width: "60%",
    aspectRatio: 1,
  }
});