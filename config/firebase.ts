// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBUo98KzrszHkUInRd7A-5ZX9gdtNjWMEM",
  authDomain: "furrever-expo.firebaseapp.com",
  projectId: "furrever-expo",
  storageBucket: "furrever-expo.firebasestorage.app",
  messagingSenderId: "450691309926",
  appId: "1:450691309926:web:bd573adced42b7e38ee8a7",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

//auth
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// database firestore db
export const firestore = getFirestore(app);
