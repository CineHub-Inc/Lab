import { initSearchLogic } from '../search-bar.js';
import { init as initHistoryTrail } from '../history-trail/history-trail.js';
import { showAuthModal } from '../auth.js';

function render() {
    const controlsContainer = document.getElementById('page-controls');
    if (!controlsContainer) return;

    controlsContainer.innerHTML = `
        <div class="command-bar" id="command-bar">
            <div class="search-widget" id="command-bar-search-widget">
                 <input type="search" class="search-input" id="command-bar-search-input" placeholder="Search...">
                <button class="command-bar-btn search-toggle" id="command-bar-search-toggle" aria-label="Toggle Search">
                    <i class="fas fa-search"></i>
                </button>
                <div class="search-results" id="search-results"></div>
            </div>

            <button class="command-bar-btn filter-trigger-btn" id="filter-trigger-btn" aria-label="Open filters">
                <i class="fas fa-sliders-h"></i>
            </button>
            
            <div class="history-trail-widget" id="history-trail-widget">
                <button class="command-bar-btn" id="history-trail-toggle" aria-label="View history">
                    <i class="fas fa-history"></i>
                </button>
                <div id="history-trail-dropdown" class="history-trail-dropdown"></div>
            </div>

            <div id="command-bar-login-widget">
                 <button class="command-bar-btn" id="login-btn" aria-label="Login">
                    <i class="fa-regular fa-circle-user"></i>
                </button>
            </div>

            <div class="profile-widget" id="command-bar-profile-widget">
                <button class="command-bar-btn" id="profile-toggle-btn" aria-haspopup="true" aria-expanded="false" aria-label="Profile menu">
                    <i class="fa-regular fa-circle-user"></i>
                </button>
                <div class="profile-dropdown" role="menu">
                    <a href="#taste-profile" class="profile-dropdown-item" role="menuitem">
                        <i class="fas fa-dna"></i>
                        <span>Taste Profile</span>
                    </a>
                    <div class="profile-dropdown-divider"></div>
                    <a href="#" id="logout-link" class="profile-dropdown-item" role="menuitem">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Logout</span>
                    </a>
                </div>
            </div>
        </div>
    `;
}

function addEventListeners() {
    const commandBar = document.getElementById('command-bar');
    const searchWidget = document.getElementById('command-bar-search-widget');
    const searchToggle = document.getElementById('command-bar-search-toggle');
    const searchInput = document.getElementById('command-bar-search-input');

    if (!commandBar || !searchWidget || !searchToggle) return;

    searchToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = commandBar.classList.toggle('is-active');
        searchWidget.classList.toggle('is-active'); // for mobile
        if (isActive) {
            searchInput.focus();
        }
    });

    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showAuthModal();
        });
    }

    const profileWidget = document.getElementById('command-bar-profile-widget');
    const profileToggle = document.getElementById('profile-toggle-btn');
    
    if (profileWidget && profileToggle) {
        profileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = profileWidget.classList.toggle('is-active');
            profileToggle.setAttribute('aria-expanded', isActive);
        });

        // Close dropdown when an item is clicked
        const dropdown = profileWidget.querySelector('.profile-dropdown');
        if (dropdown) {
            dropdown.addEventListener('click', (e) => {
                if (e.target.closest('.profile-dropdown-item')) {
                    profileWidget.classList.remove('is-active');
                    profileToggle.setAttribute('aria-expanded', 'false');
                }
            });
        }
    }
}


function init() {
    render();
    addEventListeners();
    initSearchLogic();
    initHistoryTrail();
}

init();