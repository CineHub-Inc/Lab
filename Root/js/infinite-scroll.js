import { getLocalWatchlist } from './watchlist.js';

/**
 * Initializes infinite scrolling on a given shelf grid.
 * @param {HTMLElement} shelfGrid - The element containing the scrollable media cards.
 * @param {function(number): Promise<object>} fetcher - A function that takes a page number and returns a promise with the data.
 * @param {function(object): string} cardCreator - A function that takes a media object and returns an HTML string for its card.
 * @param {number} [startPage=1] - The page number to start from.
 */
export function initInfiniteScroll(shelfGrid, fetcher, cardCreator, startPage = 1) {
    let currentPage = startPage;
    let isLoading = false;
    let hasMore = true;

    shelfGrid.addEventListener('scroll', async () => {
        if (!hasMore || isLoading) return;

        const { scrollLeft, scrollWidth, clientWidth } = shelfGrid;
        
        // Load more when user is near the end of the scroll
        if (scrollLeft + clientWidth >= scrollWidth - 300) {
            isLoading = true;
            currentPage++;
            
            // Add a small loader to the end of the grid
            const loader = document.createElement('div');
            loader.className = 'loader-small-infinite';
            loader.innerHTML = '<i class="fas fa-spinner"></i>';
            shelfGrid.appendChild(loader);

            try {
                const data = await fetcher(currentPage);
                if (data && data.results && data.results.length > 0) {
                    const watchlist = getLocalWatchlist();
                    const filteredResults = data.results.filter(item => {
                        const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
                        const status = watchlist.get(`${mediaType}:${item.id}`);
                        // Hide items that have been categorized by the user in any way
                        return !status;
                    });
                    
                    const newContent = filteredResults.map(cardCreator).join('');
                    shelfGrid.insertAdjacentHTML('beforeend', newContent);
                    
                    if (data.page >= data.total_pages) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false; // No more results
                }
            } catch (error) {
                console.error('Failed to fetch next page for infinite scroll:', error);
                hasMore = false; // Stop trying if there's an error
            } finally {
                // Remove the loader
                if (shelfGrid.contains(loader)) {
                    shelfGrid.removeChild(loader);
                }
                isLoading = false;
            }
        }
    });
}