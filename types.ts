import React, { ReactNode } from "react";
import {
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  TouchableOpacityProps,
  ViewStyle,
  StyleProp,
} from "react-native";

/** --- UI COMPONENT TYPES --- **/

export type ScreenWrapperProps = {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export type TypoProps = {
  size?: number;
  color?: string;
  fontWeight?: TextStyle["fontWeight"];
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  textProps?: TextProps;
};

export type accountOptionType = {
  title: string;
  icon: React.ReactNode;
  bgColor: string;
  routeName?: any;
  onPress?: () => void;
};

export type HeaderProps = {
  title?: string;
  style?: StyleProp<ViewStyle>;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export type BackButtonProps = {
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
};

export interface InputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  inputRef?: React.RefObject<TextInput>;
}

export interface CustomButtonProps extends TouchableOpacityProps {
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  loading?: boolean;
  children: React.ReactNode;
  color?: string;
}

export type ModalWrapperProps = {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  bg?: string;
};

/** --- CORE DATA MODELS --- **/

export type UserRole = 'adopter' | 'seller' | 'admin';

export type UserType = {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  petPostIds: string[];
  favorites: string[];
  adoptedPets: string[];
  image?: string | null;
  createdAt: any;
  emailVerified: boolean; 
  lastResetAttempts?: number[]; 
} | null;

// Added for the ProfileModal state
export type UserDataType = {
  name: string;
  image: string | any | null;
};

export type PetStatus = 'available' | 'sold';

export type PetType = {
  id: string;
  name: string;
  category: string;
  coatcolor: string;
  breed: string;
  description: string;
  address: string;
  image: string | any;
  ownerId: string;
  age?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  favoredBy: string[];
  status: PetStatus;
  adoptedBy?: string;
  isDeleted: boolean;
  createdAt: any;
  deletedAt?: any;
};

export type AdoptionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type AdoptionType = {
  id: string;
  petId: string;
  petName: string;
  petImage: string;
  adopterId: string;
  adopterName: string;
  ownerId: string;
  status: AdoptionStatus; 
  isRead : boolean;
  createdAt: any;
  updatedAt?: any;
  petBreed?: string;
  petCategory?: string;
  petColor?: string;
  petAge?: string | number;
};

export type CertificateStatus = 'active' | 'reissued';

export type CertificateType = {
  id: string;                    
  serialCode: string;           
  petId: string;
  adopterId: string;
  adopterName: string;
  petName: string;
  petImage: string;
  breed: string;
  category: string;
  color?: string;
  age?: string | number;
  issuedAt: any;
  issuedBy: 'system' | string;   
  version: number;               
  status: CertificateStatus;
  notes?: string;               
};
/** --- CONTEXT & API RESPONSE TYPES --- **/

export type ResponseType = {
  success: boolean;
  data?: any;
  msg?: string;
};

export type CloudinaryResponse = {
  success: boolean;
  data?: any;
  msg?: string;
};

/** --- CONTEXT DEFINITIONS --- **/

export type AuthContextType = {
  user: UserType;
  setUser: React.Dispatch<React.SetStateAction<UserType>>;
  initialized: boolean;
  terminatedOnLogin: boolean;
  clearTerminatedOnLogin: () => void;
  login: (email: string, password: string) => Promise<ResponseType>;
  register: (email: string, password: string, name: string) => Promise<ResponseType>;
  logout: () => Promise<ResponseType>;
  reloadUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<ResponseType>;
  sendVerification: () => Promise<ResponseType>;
  promoteToSeller: (uid: string) => Promise<void>;
  addPetPostId: (uid: string, petId: string) => Promise<void>;
  removePetPostId: (uid: string, petId: string) => Promise<void>;
};

export type PetContextType = {
  pets: PetType[];
  addPet: (petData: CreatePetDTO, imageFile: any) => Promise<CloudinaryResponse>;
  updatePet: (id: string, updates: Partial<PetType>, imageFile?: any) => Promise<CloudinaryResponse>;
  deletePet: (id: string) => Promise<CloudinaryResponse>;
  markAsSold: (id: string, adopterId: string) => Promise<CloudinaryResponse>;
  toggleFavorite: (petId: string) => Promise<void>;
};

export type AdoptionContextType = {
  applications: AdoptionType[];
  loading: boolean;
  sendApplication: (pet: PetType) => Promise<ResponseType>;
  cancelApplication: (appId: string) => Promise<ResponseType>;
  updateApplicationStatus: (appId: string, petId: string, status: 'approved' | 'rejected') => Promise<ResponseType>;
};

export type CertificateContextType = {
  loading: boolean;
  downloadPDF: (certificate: CertificateType) => Promise<void>;
};

export type ChatContextType = {
  rooms: ChatRoomType[];
  loadingRooms: boolean;
  getOrCreateChatRoom: (targetUserId: string, targetName: string, targetImage: string) => Promise<string | null>;
  markAsRead: (roomId: string) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
};

/** --- UTILITY & HELPER TYPES --- **/

export type CreatePetDTO = Omit<PetType, "id" | "favoredBy" | "status" | "isDeleted" | "createdAt" | "image">;

export type ChatRoomType = {
  id: string;
  participants: string[];
  participantMetadata: {
    [key: string]: {
      name: string;
      image: string;
    };
  };
  lastMessage: string;
  updatedAt: any;
  lastRead: {
    [key: string]: any;
  };
};

export type MessageType = {
  id: string;
  senderId: string;
  type: 'text' | 'image' | 'location';
  content: any;
  createdAt: any; 
};

/** --- NOTIFICATION MODELS --- **/

export type NotificationType = {
  id: string;
  receiverId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: any;
  type?: 'adoption_update' | 'new_request' | 'chat';
};