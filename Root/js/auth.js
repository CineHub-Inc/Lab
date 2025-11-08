import { auth, db } from './firebase.js';
import { 
    onAuthStateChanged,
    signInWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { openModal, closeModal } from './modal.js';
import { fetchWatchlist, getLocalWatchlist } from './watchlist.js';
import { showToast } from './toast.js';
import { showProgressBar, updateProgress, hideProgressBar } from './loading-progress-bar/loading-progress-bar.js';
import { clearTasteProfile, buildInitialProfileFromLibrary } from './algorithm/taste-profile.js';

function getAuthModalHtml() {
    return `
        <div class="auth-modal-content">
            <div class="auth-tabs">
                <button class="auth-tab active" data-tab="login">Login</button>
                <button class="auth-tab" data-tab="waiting-list">Waiting List</button>
            </div>
            <div id="login-container" class="auth-form-container active">
                <form id="login-form" class="auth-form">
                    <div class="form-group">
                        <label for="login-id">User ID</label>
                        <input type="text" id="login-id" placeholder="Enter Your ID" required>
                    </div>
                    <div class="form-group">
                        <label for="login-password">Password</label>
                        <div class="password-wrapper">
                            <input type="password" id="login-password" required>
                            <button type="button" class="toggle-password" aria-label="Show password">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div id="login-error" class="auth-error"></div>
                    <button type="submit" class="auth-submit-btn">Login</button>
                </form>
            </div>
            <div id="waiting-list-container" class="auth-form-container">
                 <form id="waiting-list-form" class="auth-form">
                    <p class="auth-form-description">Due to high demand, we’re currently not accepting new users. Join our waiting list to be notified as soon as spots become available.</p>
                    <div class="form-group">
                        <label for="waiting-list-email">Email Address</label>
                        <input type="email" id="waiting-list-email" required>
                    </div>
                    <div id="waiting-list-message" class="auth-message"></div>
                    <div id="waiting-list-error" class="auth-error"></div>
                    <button type="submit" class="auth-submit-btn">Join Now</button>
                </form>
            </div>
        </div>
    `;
}

export function showAuthModal() {
    openModal(getAuthModalHtml(), 'auth-modal');
    setupAuthModalListeners();
}

function setupAuthModalListeners() {
    const modal = document.querySelector('.modal-container');

    // Tab switching
    modal.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            modal.querySelector('.auth-tab.active').classList.remove('active');
            tab.classList.add('active');

            modal.querySelector('.auth-form-container.active').classList.remove('active');
            modal.querySelector(`#${tab.dataset.tab}-container`).classList.add('active');
        });
    });

    // Form submissions
    modal.querySelector('#login-form').addEventListener('submit', handleLogin);
    modal.querySelector('#waiting-list-form').addEventListener('submit', handleWaitingList);

    // Password visibility toggle
    const togglePassword = modal.querySelector('.toggle-password');
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const passwordInput = modal.querySelector('#login-password');
            const icon = togglePassword.querySelector('i');
            const isPassword = passwordInput.type === 'password';

            passwordInput.type = isPassword ? 'text' : 'password';
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
            togglePassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById('login-id').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const submitBtn = e.target.querySelector('.auth-submit-btn');

    const email = `${id.trim()}@cine.hub`;

    submitBtn.disabled = true;
    errorDiv.classList.remove('show');
    showProgressBar();

    try {
        updateProgress(10, 'Authenticating...');
        await new Promise(resolve => setTimeout(resolve, 500));
        await signInWithEmailAndPassword(auth, email, password);
        
        updateProgress(40, 'Loading your library...');
        await fetchWatchlist();
        
        // Taste profile generation
        const user = auth.currentUser;
        if (user) {
            const MIGRATION_FLAG_KEY = `cinehub-profileMigrated-${user.uid}`;
            const needsMigration = !localStorage.getItem(MIGRATION_FLAG_KEY);
            const watchlist = getLocalWatchlist();

            if (needsMigration && watchlist.size > 0) {
                const profileProgressCallback = (percentage, message) => {
                    // Map 0-100% of profile building to the 40-95% range of login
                    const overallProgress = 40 + (percentage * 0.55); 
                    updateProgress(overallProgress, message);
                };
                await buildInitialProfileFromLibrary(watchlist, profileProgressCallback);
            }
        }
        
        updateProgress(95, 'Finalizing...');
        await new Promise(resolve => setTimeout(resolve, 400));
        
        updateProgress(100, 'Welcome!');
        await new Promise(resolve => setTimeout(resolve, 500));

        hideProgressBar();
        
        setTimeout(() => {
            closeModal();
            showToast({ message: 'Successfully logged in!', type: 'success' });
        }, 300);

    } catch (error) {
        hideProgressBar();
        let errorMessage = 'An unexpected error occurred. Please try again later.';
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Invalid ID or password. Please try again.';
        } else {
            console.error('Login error:', error);
        }
        errorDiv.textContent = errorMessage;
        errorDiv.classList.add('show');
    } finally {
        submitBtn.disabled = false;
    }
}


async function handleWaitingList(e) {
    e.preventDefault();
    const emailInput = document.getElementById('waiting-list-email');
    const email = emailInput.value;
    const errorDiv = document.getElementById('waiting-list-error');
    const messageDiv = document.getElementById('waiting-list-message');
    const submitBtn = e.target.querySelector('.auth-submit-btn');

    errorDiv.classList.remove('show');
    messageDiv.classList.remove('show', 'success');
    submitBtn.disabled = true;

    try {
        await addDoc(collection(db, "waiting_list"), {
            email: email,
            createdAt: serverTimestamp()
        });

        messageDiv.textContent = "You're on the list! We'll be in touch soon.";
        messageDiv.classList.add('show', 'success');
        emailInput.value = ''; // Clear input
        
    } catch (error) {
        console.error("Error adding to waiting list: ", error);
        errorDiv.textContent = 'Could not add to waiting list. Please try again.';
        errorDiv.classList.add('show');
    } finally {
        submitBtn.disabled = false; // Re-enable on success or error
    }
}


async function handleLogout() {
    try {
        await signOut(auth);
        clearTasteProfile();
        if (window.location.hash === '#library' || window.location.hash === '#taste-profile') {
            window.location.hash = '#home';
        }
        showToast({ message: 'Logged out.', type: 'info' });
    } catch (error) {
        console.error("Logout error:", error);
    }
}

export function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        document.body.classList.toggle('logged-in', !!user);
        await fetchWatchlist(); // Fetch watchlist on auth state change

        if (user) {
            const MIGRATION_FLAG_KEY = `cinehub-profileMigrated-${user.uid}`;
            const needsMigration = !localStorage.getItem(MIGRATION_FLAG_KEY);
            const watchlist = getLocalWatchlist();

            if (needsMigration && watchlist.size > 0) {
                showProgressBar();
                await buildInitialProfileFromLibrary(watchlist, updateProgress);
                hideProgressBar();
            }
        }
    });
    
    // Use delegation for auth and logout links since they are dynamic
    document.body.addEventListener('click', e => {
        const logoutLink = e.target.closest('#logout-link');
        if (logoutLink) {
            e.preventDefault();
            handleLogout();
        }
    });
}