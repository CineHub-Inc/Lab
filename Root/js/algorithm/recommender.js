import { getTasteProfile, ATTRIBUTE_WEIGHTS } from './taste-profile.js';
import { discoverMedia, getMediaDetails } from '../api.js';
import { getLocalWatchlist } from '../watchlist.js';

/**
 * Scores a media item based on data available in the 'discover' endpoint response.
 * @param {object} mediaItem The media item to score.
 * @param {object} tasteProfile The user's taste profile.
 * @returns {number} The calculated preliminary recommendation score.
 */
function scoreMediaItemSimple(mediaItem, tasteProfile) {
    let score = 0;
    if (mediaItem.genre_ids && tasteProfile.genres) {
        mediaItem.genre_ids.forEach(genreId => {
            score += (tasteProfile.genres[genreId] || 0) * ATTRIBUTE_WEIGHTS.genres;
        });
    }
    if (mediaItem.original_language && tasteProfile.languages) {
        score += (tasteProfile.languages[mediaItem.original_language] || 0) * ATTRIBUTE_WEIGHTS.languages;
    }
    if (mediaItem.origin_country && tasteProfile.countries) {
        mediaItem.origin_country.forEach(countryCode => {
            score += (tasteProfile.countries[countryCode] || 0) * ATTRIBUTE_WEIGHTS.countries;
        });
    }
    return score;
}

/**
 * Scores a media item using its full details, including credits.
 * @param {object} mediaDetails The full media details object from getMediaDetails.
 * @param {object} tasteProfile The user's taste profile.
 * @returns {number} The calculated final recommendation score.
 */
function scoreMediaItemDetailed(mediaDetails, tasteProfile) {
    let score = 0;
    mediaDetails.genres?.forEach(genre => {
        score += (tasteProfile.genres[genre.id] || 0) * ATTRIBUTE_WEIGHTS.genres;
    });
    if (mediaDetails.original_language) {
        score += (tasteProfile.languages[mediaDetails.original_language] || 0) * ATTRIBUTE_WEIGHTS.languages;
    }
    mediaDetails.production_countries?.forEach(country => {
        score += (tasteProfile.countries[country.iso_3166_1] || 0) * ATTRIBUTE_WEIGHTS.countries;
    });
    const director = mediaDetails.credits?.crew?.find(person => person.job === 'Director');
    if (director) {
        score += (tasteProfile.directors[director.id] || 0) * ATTRIBUTE_WEIGHTS.director;
    }
    mediaDetails.credits?.cast?.slice(0, 5).forEach(actor => {
        score += (tasteProfile.actors[actor.id] || 0) * ATTRIBUTE_WEIGHTS.actors;
    });
    return score;
}


/**
 * Generates personalized media recommendations for the user.
 * @param {string} mediaType 'movie' or 'tv'.
 * @param {number} count The number of recommendations to return.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of recommended media items.
 */
export async function getRecommendations(mediaType, count = 20) {
    const tasteProfile = getTasteProfile();
    const hasProfile = Object.values(tasteProfile).some(category => Object.keys(category).length > 0);

    if (!hasProfile) {
        return [];
    }

    const watchlist = getLocalWatchlist();
    const seenIds = new Set(Array.from(watchlist.keys()));
    const candidatePool = [];

    // Stage 1: Candidate Filtering & Preliminary Scoring
    const pagesToFetch = 5;
    const discoverFilters = { sort_by: 'popularity.desc' };
    
    const dominantLanguages = Object.entries(tasteProfile.languages || {})
        .filter(([, score]) => score > 0)
        .map(([langCode]) => langCode);

    if (dominantLanguages.length > 0) {
        discoverFilters.with_original_language = dominantLanguages.join('|');
    }

    for (let i = 1; i <= pagesToFetch; i++) {
        const data = await discoverMedia(mediaType, discoverFilters, i);
        if (data?.results) {
            candidatePool.push(...data.results);
        }
    }
    
    const uniqueCandidates = Array.from(new Map(candidatePool.map(item => [item.id, item])).values());
    const filteredCandidates = uniqueCandidates.filter(item => 
        !seenIds.has(`${item.media_type || mediaType}:${item.id}`)
    );

    const preliminaryScored = filteredCandidates.map(item => ({
        ...item,
        media_type: item.media_type || mediaType,
        preliminaryScore: scoreMediaItemSimple(item, tasteProfile),
    })).filter(item => item.preliminaryScore > 0)
       .sort((a, b) => b.preliminaryScore - a.preliminaryScore);

    const promisingCandidates = preliminaryScored.slice(0, count * 2.5);

    // Stage 2: Detailed Scoring
    const detailPromises = promisingCandidates.map(item => getMediaDetails(item.id, item.media_type));
    const detailedResults = await Promise.allSettled(detailPromises);

    const finalScoredCandidates = [];
    for (const result of detailedResults) {
        if (result.status === 'fulfilled' && result.value) {
            const mediaDetails = result.value;
            const finalScore = scoreMediaItemDetailed(mediaDetails, tasteProfile);
            if (finalScore > 0) {
                finalScoredCandidates.push({
                    ...mediaDetails,
                    media_type: mediaDetails.first_air_date ? 'tv' : 'movie',
                    recommendationScore: finalScore,
                });
            }
        }
    }
    
    // Stage 3: Final Ranking
    finalScoredCandidates.sort((a, b) => b.recommendationScore - a.recommendationScore);

    return finalScoredCandidates.slice(0, count);
}