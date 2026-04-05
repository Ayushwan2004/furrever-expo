import React, { useRef, useState, useEffect, useCallback } from "react";
import { Alert, StyleSheet, View, Pressable, KeyboardAvoidingView, Platform, ScrollView, Keyboard, InteractionManager } from "react-native";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import * as Haptics from 'expo-haptics';

import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Input from "@/components/Input";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/themes";
import { useAuth } from "@/contexts/AuthContext";
import { verticalScale } from "@/utils/styling";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const isBusy = useRef(false);
  const isMounted = useRef(true);
  const router = useRouter();
  const { register: registerUser } = useAuth();

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const handleAction = useCallback(async (action: () => Promise<void>) => {
    if (isBusy.current || !isMounted.current) return;
    isBusy.current = true;
    try {
      await action();
    } finally {
      setTimeout(() => { if (isMounted.current) isBusy.current = false; }, 800);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    handleAction(async () => {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();

      if (!trimmedName || !trimmedEmail || !password.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Sign up", "Please fill all fields.");
        return;
      }

      try {
        setIsLoading(true);
        Keyboard.dismiss();
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const res = await registerUser(trimmedEmail, password, trimmedName);
        
        if (res.success) {
            // Success handled by AuthContext atomic routing
        } else if (isMounted.current) {
          if (res.msg !== "email-already-in-use") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Sign up", "We couldn't create your account.");
          }
        }
      } finally {
        if (isMounted.current) setIsLoading(false);
      }
    });
  }, [name, email, password, handleAction, registerUser]);

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <BackButton iconSize={28} />
          <View style={styles.welcomeText}><Typo size={30} fontWeight={"800"}>Let's</Typo><Typo size={30} fontWeight={"800"}>Get Started</Typo></View>
          <View style={styles.form}>
            <Typo size={19} color={colors.textLight}>Create an account</Typo>
            <Input placeholder="Enter your name (Max 8)" value={name} maxLength={8} onChangeText={setName} icon={<Icons.User size={verticalScale(26)} color={colors.green} weight="fill" />} />
            <Input placeholder="Enter your email" value={email} autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} icon={<Icons.At size={verticalScale(26)} color={colors.green} weight="fill" />} />
            <Input placeholder="Enter your password" value={password} secureTextEntry onChangeText={setPassword} icon={<Icons.Lock size={verticalScale(26)} color={colors.green} weight="fill" />} />
            <Button loading={isLoading} onPress={handleSubmit} style={styles.signupButton}><Typo fontWeight={"700"} color={colors.background} size={21}>Sign up</Typo></Button>
          </View>
          <View style={styles.footer}>
            <Typo size={15} color={colors.text}>Already have an account?</Typo>
            <Pressable onPress={() => handleAction(async () => router.replace("/(auth)/login"))}>
              <Typo size={15} fontWeight={"700"} color={colors.textLight}>Login</Typo>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

export default React.memo(Register);

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, gap: spacingY._30, paddingHorizontal: spacingX._20, paddingBottom: spacingY._30 },
  form: { gap: spacingY._20 },
  welcomeText: { marginTop: spacingY._20 },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, marginTop: 'auto', paddingTop: 20 },
  signupButton: { alignSelf: "center", width: verticalScale(350), marginTop: spacingY._10 },
});