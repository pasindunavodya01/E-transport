import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Replace with your real Firebase config
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "mock_api_key",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "mock_domain",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "mock_project_id",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "mock_bucket",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "mock_sender",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "mock_app_id"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Simple mock auth for development
export const isMockAuth = firebaseConfig.apiKey === "mock_api_key";

// Deterministic UID based on email so register and login always produce the same UID
const getMockUid = (email) => `mock-uid-${email.replace(/[^a-z0-9]/gi, '-')}`;

// Build a minimal fake JWT (header.payload.signature) that the backend mock decoder can parse
const makeMockToken = (email) => {
  const uid = getMockUid(email);
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/=/g, '');
  const payload = btoa(JSON.stringify({ user_id: uid, email, sub: uid })).replace(/=/g, '');
  return `${header}.${payload}.mock-signature`;
};

export const mockLogin = async (email) => {
  const uid = getMockUid(email);
  return { user: { uid, email, getIdToken: async () => makeMockToken(email) } };
};

export const mockRegister = async (email) => {
  const uid = getMockUid(email);
  return { user: { uid, email, getIdToken: async () => makeMockToken(email) } };
};
