// ============================================================
//  firebase-config.js
//  Inicialização do Firebase (App, Firestore, Auth) para o
//  StockFlow — Sistema de Pedidos de Material — Viu Internet.
//
//  Projeto Firebase: pedidosmaterial-b97f5
//  Coleções usadas:  pedidos · catalogo · tecnicos
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCF3WLMNxbsUih3Gg9V2EQVWvo7Rr2Ers",
  authDomain: "pedidosmaterial-b97f5.firebaseapp.com",
  projectId: "pedidosmaterial-b97f5",
  storageBucket: "pedidosmaterial-b97f5.firebasestorage.app",
  messagingSenderId: "803568374697",
  appId: "1:803568374697:web:29001b826d0106bdf36ab8"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
