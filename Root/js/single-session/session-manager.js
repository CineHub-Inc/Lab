import { db, auth } from '../firebase.js';
import { doc, deleteDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// This collection stores active user sessions.
// IMPORTANT: You must create this collection in your Firestore database.
const COLLECTION_NAME = 'user-single-session';

// These users can have multiple sessions and bypass the single-session check.
const EXCEPTION_USERS = [
    'master@cine.hub',
    'admin@cine.hub',
    'god@cine.hub'
];

/**
 * Checks for an active session and creates a new one if none exists.
 * This function uses a Firestore transaction to ensure atomic read/write,
 * preventing race conditions where a user might log in from two devices simultaneously.
 * @param {object} user - The Firebase auth user object.
 * @throws {Error} Throws "ACTIVE_SESSION_EXISTS" if an active session is found.
 * @throws {Error} Throws a generic error if the Firestore transaction fails.
 */
export async function checkAndCreateSession(user) {
    // b. If user is an exception, skip the check.
    if (EXCEPTION_USERS.includes(user.email)) {
        console.log(`User ${user.email} is an exception. Skipping single-session check.`);
        return;
    }

    const sessionRef = doc(db, COLLECTION_NAME, user.uid);

    try {
        // a.1. Use a transaction to check for an existing session.
        await runTransaction(db, async (transaction) => {
            const sessionDoc = await transaction.get(sessionRef);

            // c. If an active session document is found...
            if (sessionDoc.exists()) {
                // c.1. ...block the login attempt.
                console.warn(`Active session found for user ${user.uid}. Blocking new login.`);
                throw new Error("ACTIVE_SESSION_EXISTS");
            }

            // b.1. If no session exists, create a new session document.
            console.log(`No active session found for user ${user.uid}. Creating new session.`);
            transaction.set(sessionRef, {
                loggedInAt: serverTimestamp(),
                email: user.email,
            });
        });
        // b.2. User gains access.
        console.log(`Session successfully created for user ${user.uid}.`);
    } catch (error) {
        if (error.message === "ACTIVE_SESSION_EXISTS") {
            throw error; // Re-throw for the login handler to catch.
        }
        console.error("Firestore transaction for session management failed:", error);
        throw new Error("Could not verify user session. Please check Firestore permissions and ensure the 'user-single-session' collection exists.");
    }
}

/**
 * Clears the user's active session document from Firestore upon logout.
 * @param {string} userId - The Firebase auth user ID.
 */
export async function clearSession(userId) {
    if (!userId) return;

    const user = auth.currentUser;
    if (user && EXCEPTION_USERS.includes(user.email)) {
        console.log(`User ${user.email} is an exception. Skipping session clear on logout.`);
        return;
    }
    
    // d.1. On logout, remove the session document.
    const sessionRef = doc(db, COLLECTION_NAME, userId);
    try {
        await deleteDoc(sessionRef);
        console.log(`Session cleared for user ${userId}.`);
    } catch (error) {
        console.error("Failed to clear session on logout:", error);
    }
}
