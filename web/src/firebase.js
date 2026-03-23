import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock_api_key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mock_domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mock_project_id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mock_bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "mock_sender",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "mock_app_id"
};

// If using mock config, Firebase initialization will still run, but actual auth calls will fail.
// For true mocking during development, you can wrap the auth methods.

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Helper for Mock Auth if needed:
export const isMockAuth = firebaseConfig.apiKey === "mock_api_key";

export const mockLogin = async (email) => {
  return { user: { uid: "mock-uid-123", email, getIdToken: async () => "mock-token-123" } };
};

export const mockRegister = async (email) => {
  return { user: { uid: `mock-${Date.now()}`, email, getIdToken: async () => "mock-token-123" } };
};
