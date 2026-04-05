// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PetProvider } from '@/contexts/PetContext';
import { AdoptionProvider } from '@/contexts/AdoptionContext';
import { CertificateProvider } from '@/contexts/certificationContext';
import { ChatProvider } from '@/contexts/chatContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import VerificationGateway from '@/app/(modals)/verificationGateway';

// ─── Terminated account guard ─────────────────────────────────────────────────
function TerminatedGuard() {
  const { user, initialized } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!initialized) return;

    const isTerminated = user && (user as any).adminStatus === 'terminated';
    // Use type assertion to bypass expo-router's strict typed routes for dynamic screens
    const onTerminatedScreen = (segments as string[])[0] === 'terminated';

    if (isTerminated && !onTerminatedScreen) {
      router.replace('/terminated' as any);
      return;
    }

    if (!isTerminated && onTerminatedScreen && user?.emailVerified) {
      router.replace('/(tabs)' as any);
    }
  }, [user, initialized, segments]);

  return null;
}

// ─── Stack navigator ──────────────────────────────────────────────────────────
const StackLayout = () => {
  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />

        {/* Terminated screen — no back gesture */}
        <Stack.Screen
          name="terminated"
          options={{
            presentation: 'card',
            gestureEnabled: false,
            animation: 'fade',
          }}
        />

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
      <TerminatedGuard />
    </>
  );
};

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