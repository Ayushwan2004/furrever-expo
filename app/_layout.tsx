// app/_layout.tsx
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PetProvider } from '@/contexts/PetContext';
import { AdoptionProvider } from '@/contexts/AdoptionContext';
import { CertificateProvider } from '@/contexts/certificationContext';
import { ChatProvider } from '@/contexts/chatContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import VerificationGateway from '@/app/(modals)/verificationGateway';
import TerminatedOverlay from '@/components/TerminatedOverlay';
// import NotificationBell from '@/components/NotificationBell';

SplashScreen.preventAutoHideAsync();

// ─── Stack + splash hide ──────────────────────────────────────────────────────
function StackLayout() {
  const { initialized } = useAuth();

  useEffect(() => {
    if (initialized) {
      setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 150);
    }
  }, [initialized]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="(modals)/applicationsModal"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="(modals)/chatScreenModal"
          options={{
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="(modals)/profileModal"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="(modals)/adoptionHistoryModal"
          options={{ presentation: 'modal' }}
        />
      </Stack>

      <VerificationGateway />
      <TerminatedOverlay />
    </View>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <AuthProvider>
      <PetProvider>
        <AdoptionProvider>
          <CertificateProvider>
            <ChatProvider>
              <NotificationProvider>
                <StackLayout />
              </NotificationProvider>
            </ChatProvider>
          </CertificateProvider>
        </AdoptionProvider>
      </PetProvider>
    </AuthProvider>
  );
}