import { getTvSeasonDetails, IMAGE_BASE_URL } from '../api.js';
import { formatDate } from './utils.js';

async function renderEpisodesForSeason(seriesId, seasonNumber) {
    const episodesContent = document.getElementById('episodes-content-data');
    if (!episodesContent) return;
    episodesContent.innerHTML = `<div class="loader-small"><i class="fas fa-spinner"></i></div>`;

    try {
        const seasonData = await getTvSeasonDetails(seriesId, seasonNumber);
        if (!seasonData || !seasonData.episodes || seasonData.episodes.length === 0) {
            episodesContent.innerHTML = '<p>No episode information available for this season.</p>';
            return;
        }

        const episodesHtml = seasonData.episodes.map(episode => `
            <div class="episode-card">
                <div class="episode-thumbnail">
                    ${episode.still_path ? `<img src="${IMAGE_BASE_URL}${episode.still_path}" alt="${episode.name}" loading="lazy">` : ''}
                </div>
                <div class="episode-details">
                    <h4 class="episode-title">${episode.episode_number}. ${episode.name}</h4>
                    <div class="episode-meta">
                        <span><i class="fa-regular fa-calendar"></i> ${formatDate(episode.air_date)}</span>
                        <span><i class="fas fa-star"></i> ${episode.vote_average.toFixed(1)}</span>
                    </div>
                    <p class="episode-overview">${episode.overview || 'No overview available.'}</p>
                </div>
            </div>
        `).join('');

        episodesContent.innerHTML = `<div class="episode-list">${episodesHtml}</div>`;

    } catch (error) {
        console.error(`Error fetching episodes for season ${seasonNumber}:`, error);
        episodesContent.innerHTML = '<p>Could not load episodes for this season.</p>';
    }
}

export function renderEpisodesTab(data) {
    if (!data.seasons) return '';
    
    return `
        <div id="episodes-content" class="tab-content">
            <div class="season-selector-container">
                <div class="season-buttons">
                    ${data.seasons.filter(s => s.season_number > 0).map((s, index) => `<button class="season-btn ${index === 0 ? 'active' : ''}" data-season="${s.season_number}">${s.name}</button>`).join('')}
                </div>
            </div>
            <div id="episodes-content-data"></div>
        </div>
    `;
}

export function initEpisodes(seriesId, seasons) {
    const seasonButtons = document.querySelector('.season-buttons');
    if (seasonButtons) {
        seasonButtons.addEventListener('click', (e) => {
            const button = e.target.closest('.season-btn');
            if (button) {
                seasonButtons.querySelector('.active').classList.remove('active');
                button.classList.add('active');
                renderEpisodesForSeason(seriesId, button.dataset.season);
            }
        });

        const firstSeason = seasons.find(s => s.season_number > 0);
        if (firstSeason) {
            renderEpisodesForSeason(seriesId, firstSeason.season_number);
        }
    }
}