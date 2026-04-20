import React, { useRef, useState, useCallback } from "react";
import {
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Icons from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Input from "@/components/Input";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/themes";
import { useAuth } from "@/contexts/AuthContext";
import { verticalScale } from "@/utils/styling";

const ATTEMPTS_KEY = "@password_reset_attempts";
const MAX_ATTEMPTS = 3;
const COOLDOWN = 15 * 60 * 1000;

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isBusy = useRef(false);
  const router = useRouter();
  const { login: loginUser, resetPassword } = useAuth();

  const handleAction = useCallback(async (action: () => Promise<void>) => {
    if (isBusy.current) return;
    isBusy.current = true;
    try {
      await action();
    } finally {
      setTimeout(() => { isBusy.current = false; }, 600);
    }
  }, []);

  const checkRateLimit = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    const stored = await AsyncStorage.getItem(ATTEMPTS_KEY);
    let attempts: number[] = stored ? JSON.parse(stored) : [];
    attempts = attempts.filter((t) => now - t < COOLDOWN);
    if (attempts.length >= MAX_ATTEMPTS) {
      const remaining = Math.ceil((COOLDOWN - (now - attempts[0])) / 60000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Too Many Requests",
        `Please wait ${remaining} minutes before requesting another reset link.`
      );
      return false;
    }
    attempts.push(now);
    await AsyncStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    return true;
  }, []);

  const onResetLinkPress = useCallback(async () => {
    const allowed = await checkRateLimit();
    if (!allowed) return;
    setIsLoading(true);
    const res = await resetPassword(email);
    setIsLoading(false);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Email Sent", "A password reset link has been sent to your inbox.");
    } else {
      if (res.msg === "offline") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "No Connection",
          "You appear to be offline. Please check your internet and try again."
        );
      } else if (res.msg !== "user-not-found") {
        // "user-not-found" is already handled by showNoAccountAlert() inside AuthContext
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", "Could not send reset link. Please try again.");
      }
    }
  }, [email, checkRateLimit, resetPassword]);

  const handleForgotPassword = useCallback(() => {
    handleAction(async () => {
      if (!email || email.trim().length === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Reset Password", "Please enter your email address first.");
        return;
      }
      Alert.alert(
        "Reset Password",
        `Send a reset link to ${email.trim().toLowerCase()}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Send Link", onPress: onResetLinkPress },
        ]
      );
    });
  }, [email, handleAction, onResetLinkPress]);

  const handleLogin = useCallback(() => {
    handleAction(async () => {
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail || !password) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Login", "Please enter both email and password.");
        return;
      }

      try {
        setIsLoading(true);
        Keyboard.dismiss();
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const res = await loginUser(trimmedEmail, password);

        if (!res.success) {
          switch (res.msg) {

            // ── Email exists but password is wrong ──────────────────────────
            case "wrong-password":
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(
                "Invalid Password",
                "The password you entered is incorrect. Please try again or tap 'Forgot Password?' to reset it."
              );
              break;

            // ── Email doesn't exist in the system ──────────────────────────
            // Note: the alert with Sign Up option is already shown inside
            // AuthContext via showNoAccountAlert(). No duplicate alert here.
            case "user-not-found":
              break;

            // ── Malformed email string ──────────────────────────────────────
            case "invalid-email":
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(
                "Invalid Email",
                "Please enter a valid email address."
              );
              break;

            // ── Firebase rate limiting ──────────────────────────────────────
            case "too-many-requests":
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(
                "Too Many Attempts",
                "Your account has been temporarily locked due to too many failed login attempts. Please wait a while or reset your password."
              );
              break;

            // ── Device is offline ───────────────────────────────────────────
            case "offline":
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(
                "No Connection",
                "You appear to be offline. Please check your internet connection and try again."
              );
              break;

            // ── Unverified email — VerificationGateway Modal handles UI ────
            case "email-not-verified":
              break;

            // ── Terminated account — TerminatedOverlay handles UI ───────────
            case "account-terminated":
              break;

            default:
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(
                "Login Failed",
                "Something went wrong. Please try again."
              );
          }
        }
      } finally {
        setIsLoading(false);
      }
    });
  }, [email, password, handleAction, loginUser]);

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <BackButton iconSize={28} />

          <View style={styles.welcomeText}>
            <Typo size={30} fontWeight="800">Hey Pet Lover,</Typo>
            <Typo size={30} fontWeight="800">Welcome Back</Typo>
          </View>

          <View style={styles.form}>
            <Typo size={19} color={colors.textLight}>Login to your account</Typo>

            <Input
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              icon={
                <Icons.At size={verticalScale(26)} color={colors.green} weight="fill" />
              }
            />

            <Input
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              icon={
                <Icons.Lock size={verticalScale(26)} color={colors.green} weight="fill" />
              }
            />

            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPasswordContainer}
            >
              <Typo size={14} color={colors.text} style={styles.forgotPasswordText}>
                Forgot Password?
              </Typo>
            </TouchableOpacity>

            <Button
              loading={isLoading}
              onPress={handleLogin}
              style={styles.loginButton}
            >
              <Typo fontWeight="700" color={colors.background} size={21}>
                Login
              </Typo>
            </Button>
          </View>

          <View style={styles.footer}>
            <Typo size={15} color={colors.text}>Don't have an Account?</Typo>
            <Pressable
              onPress={() => handleAction(async () => router.replace("/(auth)/register"))}
            >
              <Typo size={15} fontWeight="700" color={colors.textLight}>Sign up</Typo>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

export default React.memo(Login);

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    gap: spacingY._30,
    paddingHorizontal: spacingX._20,
    paddingBottom: spacingY._30,
  },
  form: { gap: spacingY._20 },
  welcomeText: { marginTop: spacingY._20 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: "auto",
    paddingTop: 20,
  },
  forgotPasswordContainer: { alignSelf: "flex-end" },
  forgotPasswordText: { fontWeight: "500" },
  loginButton: {
    alignSelf: "center",
    width: verticalScale(350),
    marginTop: spacingY._10,
  },
});