// contexts/AuthContext.tsx
// CHANGED from previous version:
//  1. login() now checks adminStatus === 'terminated' and blocks sign-in
//  2. fetchUserData stores full Firestore data including adminStatus
//  3. UserType extended inline to include adminStatus (no types.ts change needed)

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
} from "firebase/firestore";
import { auth, firestore } from "@/config/firebase";
import { AuthContextType, UserType, ResponseType } from "@/types";
import { registerPushToken } from "@/services/pushTokenService";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserType | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const unsubscribeFirestoreRef = useRef<Unsubscribe | null>(null);
  const isMounted = useRef(true);
  const tokenRegistered = useRef<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchUserData = (uid: string) => {
    const userDocRef = doc(firestore, "users", uid);
    if (unsubscribeFirestoreRef.current) unsubscribeFirestoreRef.current();

    unsubscribeFirestoreRef.current = onSnapshot(userDocRef, (docSnap) => {
      if (!isMounted.current) return;

      if (docSnap.exists()) {
        const data = docSnap.data();

        // ✅ Store full user data including adminStatus
        setUser({
          ...data,
          uid,
          emailVerified: !!auth.currentUser?.emailVerified,
        } as UserType);

        // ✅ If user gets terminated WHILE logged in — guard in _layout.tsx handles redirect
        // No need to do anything here — TerminatedGuard watches user state reactively
      } else if (auth.currentUser) {
        setUser({
          uid,
          email: auth.currentUser.email || "",
          name: auth.currentUser.displayName || "User",
          role: 'adopter',
          petPostIds: [], favorites: [], adoptedPets: [],
          emailVerified: !!auth.currentUser.emailVerified,
          createdAt: null,
        } as UserType);
      }
      setInitialized(true);
    }, () => {
      if (isMounted.current) setInitialized(true);
    });
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        fetchUserData(firebaseUser.uid);

        if (tokenRegistered.current !== firebaseUser.uid) {
          tokenRegistered.current = firebaseUser.uid;
          registerPushToken(firebaseUser.uid).catch(console.error);
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

  useEffect(() => {
    if (!initialized || !isMounted.current) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (user?.emailVerified && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user?.emailVerified, initialized]);

  const updateLocalAndRemote = async (field: string, value: any, isArray = false, type: "union" | "remove" = "union") => {
    if (!auth.currentUser || !isMounted.current) return;
    const docRef = doc(firestore, "users", auth.currentUser.uid);
    const payload = isArray
      ? { [field]: type === "union" ? arrayUnion(value) : arrayRemove(value) }
      : { [field]: value };
    try { await updateDoc(docRef, payload); } catch (e) { console.error(e); }
  };

  const reloadUser = async () => {
    if (!auth.currentUser || !isMounted.current) return;
    const wasVerified = user?.emailVerified;
    await auth.currentUser.reload();
    const isNowVerified = !!auth.currentUser.emailVerified;

    if (isNowVerified && !wasVerified) {
      const userRef = doc(firestore, "users", auth.currentUser.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, {
          name: auth.currentUser.displayName || "User",
          email: auth.currentUser.email,
          uid: auth.currentUser.uid,
          role: "adopter",
          petPostIds: [], favorites: [], adoptedPets: [],
          image: null,
          emailVerified: true,
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userRef, { emailVerified: true });
      }
    }
    if (isMounted.current && isNowVerified !== wasVerified) {
      setUser(prev => prev ? { ...prev, emailVerified: isNowVerified } : null);
    }
  };

  const logout = async (): Promise<ResponseType> => {
    if (unsubscribeFirestoreRef.current) unsubscribeFirestoreRef.current();

    // Clear push token on logout
    if (auth.currentUser) {
      try {
        await updateDoc(doc(firestore, "users", auth.currentUser.uid), {
          expoPushToken: null,
        });
      } catch { /* best effort */ }
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
        { text: "Sign Up", onPress: () => router.push("/(auth)/register") }
      ]
    );
  };

  const contextValue: AuthContextType = useMemo(() => ({
    user,
    setUser,
    initialized,

    login: async (e, p) => {
      try {
        const cred = await signInWithEmailAndPassword(auth, e.trim(), p);

        // ✅ Check terminated BEFORE letting them in
        const userSnap = await getDoc(doc(firestore, "users", cred.user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.adminStatus === 'terminated') {
            // Sign them back out immediately
            await signOut(auth);
            Alert.alert(
              "Account Suspended 🚫",
              "Your FurrEver account has been suspended. Visit myfurrever.vercel.app/contact for more information.",
              [{ text: "OK", style: "default" }]
            );
            return { success: false, msg: "account-terminated" };
          }
        }

        registerPushToken(cred.user.uid).catch(console.error);
        return { success: true };
      } catch (err: any) {
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
          showNoAccountAlert();
          return { success: false, msg: "user-not-found" };
        }
        return { success: false, msg: err.code };
      }
    },

    register: async (email, password, name) => {
      try {
        const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
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
              { text: "Login", onPress: () => router.push("/(auth)/login") }
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
      } catch {
        return { success: false, msg: "error" };
      }
    },

    updateUserData: async () => {},
    promoteToSeller: async () => updateLocalAndRemote("role", "seller"),
    addPetPostId: async (uid, petId) => updateLocalAndRemote("petPostIds", petId, true, "union"),
    removePetPostId: async (uid, petId) => updateLocalAndRemote("petPostIds", petId, true, "remove"),
  }), [user, initialized]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};