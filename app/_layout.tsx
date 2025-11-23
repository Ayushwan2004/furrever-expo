import { Stack } from "expo-router";
import { AuthProvider } from "@/contexts/AuthContext";
import "@/global.css";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}>
        <Stack.Screen
          name="(modals)/profileModal"
          options={{ presentation: "modal" }}/>

       
        <Stack.Screen name="(auth)" />

        <Stack.Screen name="(tabs)" />

        <Stack.Screen name="index" />
      </Stack>
    </AuthProvider>
  );
}

