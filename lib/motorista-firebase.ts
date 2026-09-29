import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Esses identificadores pertencem ao app web e são públicos por definição.
// A autorização dos dados é feita exclusivamente pelas regras do Firestore.
const config = {
  apiKey: "AIzaSyAV7fKYcZQpz9dISOKhh0O3SVAKIzFLGvM",
  authDomain: "motorista-17946.firebaseapp.com",
  projectId: "motorista-17946",
  storageBucket: "motorista-17946.firebasestorage.app",
  messagingSenderId: "986475752307",
  appId: "1:986475752307:web:52f65a6e0ae5a2080db306",
};

const app = getApps().length ? getApp() : initializeApp(config);
export const motoristaAuth = getAuth(app);
export const motoristaDb = getFirestore(app);
export const MOTORISTA_UID = "Yc7qwiq4tPcRpw4tgtrw3VfxOOh1";
