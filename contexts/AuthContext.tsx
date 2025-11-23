import { auth, firestore } from "@/config/firebase";
import { AuthContextType, UserType } from "@/types";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserType | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await updateUserData(firebaseUser.uid);
 router.replace("/(tabs)");
      } else {
        setUser(null);
        console.log("🚪 No user logged in. Redirecting to welcome...");
        router.replace("/(auth)/welcome");
      }
    });
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ Login successful for:", email);
      return { success: true };
    } catch (error: any) {
      let msg = error.message;
      if (msg.includes("(auth/invalid-credential)")) msg = "Wrong credentials";
      if (msg.includes("(auth/invalid-email)")) msg = "Please enter a valid email id";
      console.log("❌ Login failed:", msg);
      return { success: false, msg };
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      let response = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(firestore, "users", response?.user?.uid), {
        name,
        email,
        uid: response?.user?.uid,
        role: "adopter", //  default role
      });
      console.log("🎉 Registration successful. User created as adopter:", email);
      return { success: true };
    } catch (error: any) {
      let msg = error.message;
      if (msg.includes("(auth/email-already-in-use)")) msg = "This email already exists ";
      if (msg.includes("(auth/invalid-email)")) msg = "Please enter a valid email";
      if (msg.includes("Password should be at least 6 characters (auth/weak-password)"))
        msg = "Please enter a strong password, minimum 6 characters";
      console.log("❌ Registration failed:", msg);
      return { success: false, msg };
    }
  };

  const updateUserData = async (uid: string) => {
    try {
      const docRef = doc(firestore, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const userData = {
          uid: data?.uid ?? null,
          email: data?.email ?? null,
          name: data?.name ?? null,   // 👈 fixed: always string or null
          image: data?.image ?? null,
          role: data?.role ?? "adopter",
        } as UserType;
        setUser(userData);
        console.log("📥 User data loaded from Firestore:", userData);
      } else {
        console.log("⚠️ No Firestore document found for uid:", uid);
      }
    } catch (error: any) {
      console.error("❌ Error updating user data:", error.message);
    }
  };

  const promoteToSeller = async (uid: string) => {
    try {
      const docRef = doc(firestore, "users", uid);
      await updateDoc(docRef, { role: "seller" });
      setUser((prev) => (prev ? { ...prev, role: "seller" } : prev));
      console.log("🚀 User promoted to seller:", uid);
    } catch (error: any) {
      console.error("❌ Error promoting user to seller:", error.message);
    }
  };

  const contextValue = {
    user,
    setUser,
    login,
    register,
    updateUserData,
    promoteToSeller,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be wrapped inside AuthProvider");
  }
  return context;
};