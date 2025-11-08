import { handleRouteChange } from './router.js';
import { setActiveLink } from './main-menu.js';
import { initAuth } from './auth.js';

function init() {
    initAuth(); // Initialize auth listener

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash || '#home';
        setActiveLink(hash);
        handleRouteChange();
    });

    // Initial load
    const initialHash = window.location.hash || '#home';
    if (!window.location.hash) {
        window.location.hash = '#home';
    } else {
        setActiveLink(initialHash);
        handleRouteChange();
    }
}

document.addEventListener('DOMContentLoaded', init);