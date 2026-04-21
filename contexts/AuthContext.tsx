import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useSegments } from "expo-router";
import { Alert } from "react-native";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  Unsubscribe,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  serverTimestamp,
  getDoc,
  enableNetwork,
} from "firebase/firestore";
import { auth, firestore } from "@/config/firebase";
import { AuthContextType, UserType, ResponseType } from "@/types";
import { registerPushToken } from "@/services/pushTokenService";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isOfflineError = (error: any): boolean => {
  const msg: string = error?.message ?? "";
  const code: string = error?.code ?? "";
  return (
    code === "unavailable" ||
    msg.includes("client is offline") ||
    msg.includes("Backend didn't respond") ||
    msg.includes("Failed to get document because the client is offline")
  );
};

const checkEmailExists = async (
  email: string
): Promise<"exists" | "not-found" | "unknown"> => {
  try {
    const q = query(
      collection(firestore, "users"),
      where("email", "==", email.trim().toLowerCase())
    );
    const snap = await getDocs(q);
    return snap.empty ? "not-found" : "exists";
  } catch {
    return "unknown";
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserType | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [terminatedOnLogin, setTerminatedOnLogin] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const unsubscribeFirestoreRef = useRef<Unsubscribe | null>(null);
  const isMounted = useRef(true);
  const tokenRegistered = useRef<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const tryReconnect = () => {
    enableNetwork(firestore).catch(() => { });
  };

  const fetchUserData = (uid: string) => {
    const userDocRef = doc(firestore, "users", uid);
    if (unsubscribeFirestoreRef.current) unsubscribeFirestoreRef.current();
    unsubscribeFirestoreRef.current = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (!isMounted.current) return;
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUser({
            ...data,
            uid,
            emailVerified: !!auth.currentUser?.emailVerified,
          } as UserType);
        } else if (auth.currentUser) {
          setUser({
            uid,
            email: auth.currentUser.email || "",
            name: auth.currentUser.displayName || "User",
            role: "adopter",
            petPostIds: [],
            favorites: [],
            adoptedPets: [],
            emailVerified: !!auth.currentUser.emailVerified,
            createdAt: null,
          } as UserType);
        }
        if (isMounted.current) setInitialized(true);
      },
      (error) => {
        if (isOfflineError(error)) tryReconnect();
        if (isMounted.current) setInitialized(true);
      }
    );
  };

  // ── auth state listener ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        fetchUserData(firebaseUser.uid);
        // ✅ Always refresh token on every auth state change
        if (firebaseUser.emailVerified) {
          registerPushToken(firebaseUser.uid).catch((e) => {
            if (!isOfflineError(e))
              console.warn("[Auth] registerPushToken failed:", e?.message);
          });
          tokenRegistered.current = firebaseUser.uid;
        }
      } else {
        if (unsubscribeFirestoreRef.current) unsubscribeFirestoreRef.current();
        if (isMounted.current) {
          setUser(null);
          setInitialized(true);
          tokenRegistered.current = null;
        }
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestoreRef.current) unsubscribeFirestoreRef.current();
    };
  }, []);

  // ── navigation guard ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialized || !isMounted.current) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (user?.emailVerified && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user?.emailVerified, initialized]);

  const updateLocalAndRemote = async (
    field: string,
    value: any,
    isArray = false,
    type: "union" | "remove" = "union"
  ) => {
    if (!auth.currentUser || !isMounted.current) return;
    const docRef = doc(firestore, "users", auth.currentUser.uid);
    const payload = isArray
      ? { [field]: type === "union" ? arrayUnion(value) : arrayRemove(value) }
      : { [field]: value };
    try {
      await updateDoc(docRef, payload);
    } catch (e: any) {
      if (!isOfflineError(e)) console.error(e);
    }
  };

  const reloadUser = async () => {
    if (!auth.currentUser || !isMounted.current) return;
    const wasVerified = user?.emailVerified;
    await auth.currentUser.reload();
    const isNowVerified = !!auth.currentUser.emailVerified;
    if (isNowVerified && !wasVerified) {
      const userRef = doc(firestore, "users", auth.currentUser.uid);
      try {
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
          await setDoc(userRef, {
            name: auth.currentUser.displayName || "User",
            email: auth.currentUser.email,
            uid: auth.currentUser.uid,
            role: "adopter",
            petPostIds: [],
            favorites: [],
            adoptedPets: [],
            image: null,
            emailVerified: true,
            createdAt: serverTimestamp(),
          });
        } else {
          await updateDoc(userRef, { emailVerified: true });
        }
        // ✅ Always register token on verification
        if (isMounted.current) {
          tokenRegistered.current = auth.currentUser.uid;
          registerPushToken(auth.currentUser.uid).catch((e) => {
            if (!isOfflineError(e))
              console.warn("[Auth] push token error:", e?.message);
          });
        }
      } catch (e: any) {
        if (!isOfflineError(e)) console.error("[Auth] reloadUser error:", e);
      }
    }
    if (isMounted.current && isNowVerified !== wasVerified) {
      setUser((prev) => (prev ? { ...prev, emailVerified: isNowVerified } : null));
    }
  };

  const logout = async (): Promise<ResponseType> => {
    if (unsubscribeFirestoreRef.current) unsubscribeFirestoreRef.current();
    if (auth.currentUser) {
      try {
        await updateDoc(doc(firestore, "users", auth.currentUser.uid), {
          expoPushToken: null,
          fcmToken: null,
        });
      } catch {
        // best effort
      }
    }
    tokenRegistered.current = null;
    await signOut(auth);
    router.replace("/(auth)/welcome");
    return { success: true };
  };

  const showNoAccountAlert = () => {
    Alert.alert(
      "Account Not Found",
      "No account exists with this email. Would you like to sign up?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Up", onPress: () => router.push("/(auth)/register") },
      ]
    );
  };

  const contextValue: AuthContextType = useMemo(
    () => ({
      user,
      setUser,
      initialized,
      terminatedOnLogin,
      clearTerminatedOnLogin: () => setTerminatedOnLogin(false),
      login: async (e, p) => {
        const trimmedEmail = e.trim().toLowerCase();
        try {
          const cred = await signInWithEmailAndPassword(auth, trimmedEmail, p);
          try {
            const userSnap = await getDoc(doc(firestore, "users", cred.user.uid));
            if (userSnap.exists() && userSnap.data().adminStatus === "terminated") {
              await signOut(auth);
              setTerminatedOnLogin(true);
              return { success: false, msg: "account-terminated" };
            }
          } catch (firestoreErr: any) {
            if (!isOfflineError(firestoreErr)) throw firestoreErr;
          }
          if (!cred.user.emailVerified) {
            return { success: false, msg: "email-not-verified" };
          }
          return { success: true };
        } catch (err: any) {
          const code: string = err.code ?? "";
          if (
            code === "auth/wrong-password" ||
            code === "auth/invalid-credential" ||
            code === "auth/user-not-found"
          ) {
            const emailStatus = await checkEmailExists(trimmedEmail);
            if (emailStatus === "not-found") {
              showNoAccountAlert();
              return { success: false, msg: "user-not-found" };
            }
            if (emailStatus === "exists") {
              return { success: false, msg: "wrong-password" };
            }
            return { success: false, msg: "wrong-password" };
          }
          if (code === "auth/invalid-email") {
            return { success: false, msg: "invalid-email" };
          }
          if (code === "auth/too-many-requests") {
            return { success: false, msg: "too-many-requests" };
          }
          if (isOfflineError(err)) {
            return { success: false, msg: "offline" };
          }
          return { success: false, msg: code };
        }
      },
      register: async (email, password, name) => {
        try {
          const res = await createUserWithEmailAndPassword(
            auth,
            email.trim(),
            password
          );
          await updateProfile(res.user, { displayName: name.trim() });
          await sendEmailVerification(res.user);
          return { success: true };
        } catch (err: any) {
          if (err.code === "auth/email-already-in-use") {
            Alert.alert(
              "Account Exists",
              "This email is already registered. Please log in instead.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Login", onPress: () => router.push("/(auth)/login") },
              ]
            );
            return { success: false, msg: "email-already-in-use" };
          }
          return { success: false, msg: err.code };
        }
      },
      logout,
      reloadUser,
      sendVerification: async () => {
        if (auth.currentUser) {
          await sendEmailVerification(auth.currentUser);
          return { success: true };
        }
        return { success: false };
      },
      resetPassword: async (email) => {
        const trimmedEmail = email.trim().toLowerCase();
        try {
          const userQuery = query(
            collection(firestore, "users"),
            where("email", "==", trimmedEmail)
          );
          const userSnap = await getDocs(userQuery);
          if (userSnap.empty) {
            showNoAccountAlert();
            return { success: false, msg: "user-not-found" };
          }
          await sendPasswordResetEmail(auth, trimmedEmail);
          return { success: true };
        } catch (e: any) {
          if (isOfflineError(e)) return { success: false, msg: "offline" };
          return { success: false, msg: "error" };
        }
      },
      updateUserData: async () => { },
      promoteToSeller: async () => updateLocalAndRemote("role", "seller"),
      addPetPostId: async (uid, petId) =>
        updateLocalAndRemote("petPostIds", petId, true, "union"),
      removePetPostId: async (uid, petId) =>
        updateLocalAndRemote("petPostIds", petId, true, "remove"),
    }),
    [user, initialized, terminatedOnLogin]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};