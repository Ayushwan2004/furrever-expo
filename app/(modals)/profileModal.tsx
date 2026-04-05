import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Alert, ScrollView, StyleSheet, TouchableOpacity, View, KeyboardAvoidingView, Platform
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { Pencil, UserCirclePlus, SignIn, PawPrint } from "phosphor-react-native";
import { doc, updateDoc } from "firebase/firestore"; 
import { firestore } from "@/config/firebase"; 
import { uploadFileToCloudinary } from "@/services/imageService";

import ModalWrapper from "@/components/ModalWrapper";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import Typo from "@/components/Typo";
import Input from "@/components/Input";
import Button from "@/components/Button";
import UploadModal from "./UploadModal";

import { colors, spacingX, spacingY, radius } from "@/constants/themes";
import { useAuth } from "@/contexts/AuthContext";
import { verticalScale, scale } from "@/utils/styling";

interface ProfileState {
  name: string;
  image: string | any | null;
}

const ProfileModal = () => {
  const { user } = useAuth(); 
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [userData, setUserData] = useState<ProfileState>({ name: "", image: null });
  const busyLock = useRef(false);

  useEffect(() => {
    if (user) {
      setUserData({ 
        name: user.name || "", 
        image: user.image || null 
      });
    }
  }, [user]);

  const processImage = async (uri: string) => {
    try {
      return await ImageManipulator.manipulateAsync(
        uri, [{ resize: { width: 400, height: 400 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
    } catch { return { uri }; }
  };

  const handleImagePick = async (type: 'camera' | 'library') => {
    if (busyLock.current) return;
    busyLock.current = true;
    try {
      const result = type === 'camera' 
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });

      if (!result.canceled) {
        setLoading(true);
        const processed = await processImage(result.assets[0].uri);
        // Fixed: Added type annotation to 'prev'
        setUserData((prev: ProfileState) => ({ ...prev, image: processed }));
        setLoading(false);
      }
    } finally {
      busyLock.current = false;
      setModalVisible(false);
    }
  };

  const handleRemoveImage = () => {
    // Fixed: Added type annotation to 'prev'
    setUserData((prev: ProfileState) => ({ ...prev, image: null }));
    setModalVisible(false);
  };

  const onSubmit = async () => {
    const trimmedName = userData.name.trim();
    
    if (!trimmedName) {
        Alert.alert("Required", "Please enter your name.");
        return;
    }
    if (trimmedName.length > 8) {
        Alert.alert("Limit Reached", "Name cannot exceed 8 characters.");
        return;
    }
    if (busyLock.current) return;
    
    busyLock.current = true;
    setLoading(true);

    try {
      const updates: any = { name: trimmedName };
      
      const isNewFile = userData.image && typeof userData.image === 'object' && (userData.image as any).uri;
      
      if (isNewFile) {
        const uploadRes = await uploadFileToCloudinary(userData.image, "users");
        if (uploadRes.success) {
          updates.image = uploadRes.data;
        } else {
          throw new Error("Image upload failed");
        }
      } else if (userData.image === null) {
        updates.image = null;
      } 

      const userRef = doc(firestore, "users", user?.uid as string);
      await updateDoc(userRef, updates);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();

    } catch (e) { 
        console.error("Profile Update Error:", e); 
        Alert.alert("Error", "Could not update profile.");
    } finally { 
        setLoading(false); 
        busyLock.current = false; 
    }
  };

  const imageSource = useMemo(() => {
    if (typeof userData.image === "string") return { uri: userData.image };
    if ((userData.image as any)?.uri) return { uri: (userData.image as any).uri };
    return require("../../assets/Avatar.jpg");
  }, [userData.image]);

  if (!user) {
    return (
      <ModalWrapper bg={colors.background}>
        <View style={styles.guestFullContainer}>
          <View style={styles.guestHeader}><BackButton /></View>
          <View style={styles.guestCenterCard}>
            <View style={styles.playfulIconCircle}>
              <PawPrint size={scale(60)} color={colors.primary} weight="fill" />
            </View>
            <Typo size={32} fontWeight="800" style={styles.textCenter}>Ready for a buddy?</Typo>
            <Typo size={16} color={colors.textLighter} style={[styles.textCenter, { marginTop: 8 }]}>Create an account to save pets!</Typo>
            <View style={styles.guestButtonGroup}>
              <TouchableOpacity activeOpacity={0.8} style={styles.primaryJoinBtn} onPress={() => router.push('/(auth)/register')}>
                <UserCirclePlus size={24} color={colors.background} weight="bold" />
                <Typo color={colors.background} fontWeight="700" size={18}>Get Started</Typo>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} style={styles.secondaryJoinBtn} onPress={() => router.push('/(auth)/login')}>
                <SignIn size={22} color={colors.primary} weight="bold" />
                <Typo color={colors.primary} fontWeight="700" size={18}>Sign In</Typo>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper bg={colors.background}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Header title="Edit Profile" leftIcon={<BackButton />} style={styles.authHeader} />
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarWrapper}>
            <Image style={styles.avatar} source={imageSource} contentFit="cover" cachePolicy="memory-disk" />
            
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.editIcon}>
              <Pencil size={20} color="white" weight="bold" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Typo color={colors.textLight} size={14} fontWeight="600">Full Name</Typo>
                <Typo color={userData.name.length >= 8 ? colors.red : colors.textLighter} size={12}>
                    {userData.name.length}/8
                </Typo>
              </View>
              <Input 
                placeholder="Your Name" 
                value={userData.name} 
                // Fixed: Added type annotation to 'prev'
                onChangeText={(text) => setUserData((prev: ProfileState) => ({ ...prev, name: text }))}
                maxLength={8} 
              />
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button onPress={onSubmit} loading={loading} style={styles.saveButton}>
            <Typo color={colors.white} fontWeight="700" size={18}>Save Changes</Typo>
          </Button>
        </View>
      </KeyboardAvoidingView>
      
      <UploadModal 
        modalVisible={modalVisible} 
        onBackPress={() => setModalVisible(false)} 
        onCameraPress={() => handleImagePick('camera')} 
        onGalleryPress={() => handleImagePick('library')} 
        onRemovePress={handleRemoveImage} 
        isLoading={loading} 
      />
    </ModalWrapper>
  );
};

export default React.memo(ProfileModal);

const styles = StyleSheet.create({
  textCenter: { textAlign: 'center' },
  scrollContainer: { paddingHorizontal: spacingX._20, paddingBottom: spacingY._30 },
  guestFullContainer: { flex: 1 },
  guestHeader: { padding: spacingX._20 },
  guestCenterCard: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacingX._30, marginTop: -verticalScale(50) },
  playfulIconCircle: { width: scale(120), height: scale(120), backgroundColor: 'white', borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 25, elevation: 8, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 15 },
  guestButtonGroup: { width: '100%', marginTop: spacingY._40, gap: spacingY._15 },
  primaryJoinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.green, height: verticalScale(58), borderRadius: radius._20, elevation: 5, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 10 },
  secondaryJoinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'white', height: verticalScale(58), borderRadius: radius._20, borderWidth: 2, borderColor: colors.primary },
  authHeader: { paddingHorizontal: spacingX._20 },
  avatarWrapper: { alignSelf: "center", marginTop: spacingY._20, position: "relative" },
  avatar: { height: verticalScale(140), width: verticalScale(140), borderRadius: 70, borderWidth: 4, borderColor: colors.white, backgroundColor: colors.backgroundDark },
  editIcon: { position: "absolute", bottom: 5, right: 5, backgroundColor: colors.primary, padding: 10, borderRadius: 20 },
  form: { marginTop: spacingY._30, gap: spacingY._20 },
  inputGroup: { gap: 8 },
  footer: { padding: spacingX._20, borderTopWidth: 1, borderTopColor: colors.backgroundDark, backgroundColor: colors.background, paddingBottom: Platform.OS === 'ios' ? spacingY._30 : spacingY._20 },
  saveButton: { width: '100%', height: verticalScale(54), borderRadius: radius._15 }
});