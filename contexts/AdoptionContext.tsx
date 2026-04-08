import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import {
  collection, addDoc, doc, updateDoc, serverTimestamp,
  onSnapshot, arrayUnion, query, where, getDocs, getDoc, or, writeBatch
} from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { useAuth } from "./AuthContext";
import { usePets } from "./PetContext";
import { AdoptionType, AdoptionContextType, ResponseType, PetType } from "@/types";
import * as Haptics from 'expo-haptics';

import { sendExpoPush } from "@/services/pushTokenService";

const AdoptionContext = createContext<AdoptionContextType | undefined>(undefined);

// ─── Helper: fetch a user's push token from Firestore ─────────────────────────
async function getPushToken(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(firestore, "users", uid));
    if (snap.exists()) return snap.data().expoPushToken || null;
    return null;
  } catch {
    return null;
  }
}

export const AdoptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [applications, setApplications] = useState<AdoptionType[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { markAsSold } = usePets();

  useEffect(() => {
    if (!user?.uid) { setApplications([]); return; }

    const q = query(
      collection(firestore, "adoptions"),
      or(
        where("adopterId", "==", user.uid),
        where("ownerId", "==", user.uid)
      )
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const filteredApps = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            isRead: (data as any).isRead ?? false,
            createdAt: data.createdAt?.toDate?.() || data.createdAt
          } as AdoptionType;
        })
        .filter(app => app.status !== 'cancelled')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setApplications(filteredApps);
    }, (error) => {
      console.error("Adoption Sync Error:", error);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const sendApplication = async (pet: PetType): Promise<ResponseType> => {
    if (!user?.uid) return { success: false, msg: "Login required" };
    setLoading(true);
    try {
      const q = query(
        collection(firestore, "adoptions"),
        where("petId", "==", pet.id),
        where("adopterId", "==", user.uid)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const existingDoc = snap.docs[0];
        const currentStatus = existingDoc.data().status;
        if (currentStatus === 'pending') return { success: false, msg: "Already applied!" };
        if (currentStatus === 'approved') return { success: false, msg: "Already approved!" };

        await updateDoc(doc(firestore, "adoptions", existingDoc.id), {
          status: 'pending',
          createdAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(firestore, "adoptions"), {
          petId: pet.id,
          petName: pet.name,
          petImage: pet.image,
          adopterId: user.uid,
          adopterName: user.name,
          ownerId: pet.ownerId,
          status: 'pending',
          isRead: false,
          createdAt: serverTimestamp()
        });
      }

      // ✅ Notify pet owner about new adoption request
      await addDoc(collection(firestore, "notifications"), {
        receiverId: pet.ownerId,
        title: "New Adoption Request 🐾",
        message: `${user.name} wants to adopt ${pet.name}!`,
        type: 'new_request',
        isRead: false,
        createdAt: serverTimestamp(),
      });

      // ✅ Push to owner if they have a token
      const ownerToken = await getPushToken(pet.ownerId);
      if (ownerToken) {
        await sendExpoPush(
          ownerToken,
          "New Adoption Request 🐾",
          `${user.name} wants to adopt ${pet.name}!`,
          { type: 'new_request', petId: pet.id }
        );
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, msg: e.message };
    } finally {
      setLoading(false);
    }
  };

  const cancelApplication = async (appId: string): Promise<ResponseType> => {
    setLoading(true);
    try {
      await updateDoc(doc(firestore, "adoptions", appId), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { success: true };
    } catch (e: any) {
      return { success: false, msg: e.message };
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (appId: string, petId: string, status: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      const app = applications.find(a => a.id === appId);
      if (!app) throw new Error("Application not found");

      const batch = writeBatch(firestore);

      const petSnap = await getDoc(doc(firestore, "pets", petId));
      const petData = petSnap.data() as PetType;

      const mainAppRef = doc(firestore, "adoptions", appId);
      batch.update(mainAppRef, {
        status,
        petBreed: petData?.breed || "Purebreed",
        petCategory: petData?.category || "Pet",
        petColor: petData?.coatcolor || "Standard",
        petAge: petData?.age || "N/A",
        updatedAt: serverTimestamp()
      });

      if (status === 'approved') {
        const otherAppsQuery = query(
          collection(firestore, "adoptions"),
          where("petId", "==", petId),
          where("status", "==", "pending")
        );
        const otherAppsSnap = await getDocs(otherAppsQuery);

        otherAppsSnap.docs.forEach((otherDoc) => {
          if (otherDoc.id !== appId) {
            batch.update(doc(firestore, "adoptions", otherDoc.id), {
              status: 'rejected',
              updatedAt: serverTimestamp(),
              rejectionReason: "Pet adopted by another member"
            });
          }
        });
        await markAsSold(petId, app.adopterId);

        const adopterUserRef = doc(firestore, "users", app.adopterId);
        batch.update(adopterUserRef, { adoptedPets: arrayUnion(petId) });
      }

      await batch.commit();

      // ✅ Write Firestore notification (in-app)
      const notifTitle = status === 'approved'
        ? "Adoption Approved! 🎉"
        : "Application Update";
      const notifMsg = status === 'approved'
        ? `Congratulations! Your adoption request for ${app.petName} has been approved! 🐾`
        : `Your adoption request for ${app.petName} was not approved this time.`;

      await addDoc(collection(firestore, "notifications"), {
        receiverId: app.adopterId,
        title: notifTitle,
        message: notifMsg,
        type: 'adoption_update',
        isRead: false,
        createdAt: serverTimestamp(),
      });

      // ✅ Send Expo push to adopter
      const adopterToken = await getPushToken(app.adopterId);
      if (adopterToken) {
        await sendExpoPush(
          adopterToken,
          notifTitle,
          notifMsg,
          { type: 'adoption_update', petId, status }
        );
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { success: true };
    } catch (e: any) {
      console.error("Status Update Error:", e);
      return { success: false, msg: e.message };
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({
    applications,
    loading,
    sendApplication,
    cancelApplication,
    updateApplicationStatus,
  }), [applications, loading]);

  return <AdoptionContext.Provider value={value}>{children}</AdoptionContext.Provider>;
};

export const useAdoption = () => {
  const context = useContext(AdoptionContext);
  if (!context) throw new Error("useAdoption must be used within AdoptionProvider");
  return context;
};