import { getTrending, discoverMedia, getUpcomingMovies } from './api.js';
import { renderShelf } from './ui-components.js';
import { auth } from './firebase.js';
import { renderPersonalizedShelves } from './algorithm/shelves.js';

/**
 * Renders all the shelves for the home page.
 * @param {HTMLElement} appRoot - The main application container.
 * @param {object} params - The URL query parameters (not used on home page, but passed by router).
 */
export function renderHomePageShelves(appRoot, params) {
    appRoot.innerHTML = ''; // Clear previous content

    // Render personalized shelves first if user is logged in
    if (auth.currentUser) {
        renderPersonalizedShelves(appRoot);
    }

    const shelves = [
        { 
            title: 'Trending Today', 
            fetcher: (page) => getTrending('day', page),
            options: { spreadRandom: true, autoplay: true }
        },
        { 
            title: 'Popular This Week', 
            fetcher: (page) => getTrending('week', page),
            options: { spreadRandom: true }
        },
        { 
            title: 'Top Rated Films', 
            fetcher: (page) => discoverMedia('movie', { sort_by: 'vote_average.desc', 'vote_count.gte': 500 }, page),
            options: { spreadRandom: true }
        },
        {
            title: 'Upcoming Movies',
            fetcher: (page) => getUpcomingMovies(page),
            options: { spreadRandom: true }
        },
        { 
            title: 'Must-See TV Series', 
            fetcher: (page) => discoverMedia('tv', { sort_by: 'popularity.desc' }, page),
            options: { spreadRandom: true }
        },
        {
            title: 'Action & Adventure',
            fetcher: (page) => discoverMedia('movie', { with_genres: '28,12' }, page),
            options: { spreadRandom: true }
        }
    ];

    shelves.forEach(shelf => {
        renderShelf(appRoot, shelf.title, shelf.fetcher, shelf.options);
    });
}
