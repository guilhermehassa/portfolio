import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

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

export const MOTORISTA_UID = "Yc7qwiq4tPcRpw4tgtrw3VfxOOh1";

function motoristaApp() {
  if (typeof window === "undefined") throw new Error("O Firebase do Motorista só pode iniciar no navegador.");
  const app = getApps().length ? getApp() : initializeApp(config);
  if (app.options.projectId !== config.projectId)
    throw new Error("O projeto Firebase inicializado não corresponde ao Motorista.");
  return app;
}

export function getMotoristaAuth(): Auth {
  return getAuth(motoristaApp());
}

export function getMotoristaDb(): Firestore {
  return getFirestore(motoristaApp());
}
