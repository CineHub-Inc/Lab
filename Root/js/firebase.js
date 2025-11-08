// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJ8wHJieC0egMfLKmZTit2yMUmLozASIA",
  authDomain: "ch02-9c03f.firebaseapp.com",
  projectId: "ch02-9c03f",
  storageBucket: "ch02-9c03f.firebasestorage.app",
  messagingSenderId: "816732685935",
  appId: "1:816732685935:web:f48eed084af24d7da3af9a",
  measurementId: "G-3CCMB1TCWJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);