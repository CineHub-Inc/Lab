import { db, auth } from './firebase.js';
import { doc, getDoc, setDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { updateTasteProfile, clearTasteProfile } from './algorithm/taste-profile.js';

let localWatchlist = new Map();

export function getLocalWatchlist() {
    return localWatchlist;
}

export async function fetchWatchlist() {
    const user = auth.currentUser;
    if (!user) {
        localWatchlist.clear();
        clearTasteProfile();
        updateAllWatchlistIcons();
        return;
    }

    const docRef = doc(db, "watchlists", user.uid);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().items) {
            const items = docSnap.data().items;
            let needsUpdate = false;

            let itemList = Object.entries(items).map(([key, value], index) => {
                if (typeof value === 'string') {
                    needsUpdate = true;
                    return [key, { status: value, order: index }];
                }
                if (value.order === undefined || value.order === null) {
                    needsUpdate = true;
                    value.order = index;
                }
                return [key, value];
            });

            itemList.sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

            if (needsUpdate) {
                const updatedItems = {};
                itemList.forEach(([key, value], index) => {
                    value.order = index;
                    updatedItems[key] = value;
                });
                updateDoc(docRef, { items: updatedItems }).catch(err => console.error("Firestore migration failed", err));
                localWatchlist = new Map(Object.entries(updatedItems));
            } else {
                localWatchlist = new Map(itemList);
            }
        } else {
            localWatchlist.clear();
            await setDoc(docRef, { items: {} });
        }
        
    } catch (error) {
        console.error("Error fetching watchlist:", error);
        localWatchlist.clear();
    }
    updateAllWatchlistIcons();
}

export function getItemStatus(mediaId, mediaType) {
    if (!mediaId || !mediaType) return null;
    const item = localWatchlist.get(`${mediaType}:${mediaId}`);
    return item ? item.status : null;
}

export async function updateItemStatus(mediaId, mediaType, status) {
    const user = auth.currentUser;
    if (!user) return false;

    const docRef = doc(db, "watchlists", user.uid);
    const itemIdentifier = `${mediaType}:${mediaId}`;
    const previousStatus = getItemStatus(mediaId, mediaType) || 'remove';

    try {
        if (status === 'remove') {
            await updateDoc(docRef, { [`items.${itemIdentifier}`]: deleteField() });
            localWatchlist.delete(itemIdentifier);
        } else {
            const currentItem = localWatchlist.get(itemIdentifier);
            const order = currentItem?.order ?? (localWatchlist.size > 0 ? Math.max(...Array.from(localWatchlist.values()).map(item => item.order || 0)) + 1 : 0);
            
            // Preserve existing rating when changing status
            const userRating = currentItem?.userRating || null;
            const updatedItem = { status, order };
            if (userRating) {
                updatedItem.userRating = userRating;
            }

            await updateDoc(docRef, { [`items.${itemIdentifier}`]: updatedItem });
            localWatchlist.set(itemIdentifier, updatedItem);
        }

        updateTasteProfile(mediaId, mediaType, status, previousStatus);
        updateWatchlistIcon(mediaId, mediaType);
        return true;
    } catch (e) {
        console.error("Error updating watchlist status: ", e);
        if (e.code === 'not-found' && status !== 'remove') {
             try {
                const order = localWatchlist.size > 0 ? Math.max(...Array.from(localWatchlist.values()).map(item => item.order || 0)) + 1 : 0;
                const newItem = { status, order };
                await setDoc(docRef, { items: { [itemIdentifier]: newItem } });
                localWatchlist.set(itemIdentifier, newItem);
                updateTasteProfile(mediaId, mediaType, status, previousStatus);
                updateWatchlistIcon(mediaId, mediaType);
                return true;
             } catch (setErr) {
                 console.error("Error creating watchlist doc:", setErr);
                 return false;
             }
        }
        return false;
    }
}

export async function updateItemRating(mediaId, mediaType, rating) {
    const user = auth.currentUser;
    if (!user) return false;

    const docRef = doc(db, "watchlists", user.uid);
    const itemIdentifier = `${mediaType}:${mediaId}`;
    
    if (!localWatchlist.has(itemIdentifier)) {
        console.error("Attempted to rate an item that is not on any list.");
        return false;
    }

    try {
        // Use dot notation to update a field within a map without overwriting status/order
        await updateDoc(docRef, {
            [`items.${itemIdentifier}.userRating`]: rating
        });
        
        // Update local cache
        const currentItem = localWatchlist.get(itemIdentifier);
        currentItem.userRating = rating;
        localWatchlist.set(itemIdentifier, currentItem);
        updateWatchlistIcon(mediaId, mediaType);

        return true;
    } catch (e) {
        console.error("Error updating item rating: ", e);
        return false;
    }
}

export async function updateWatchlistOrder(orderedIds) {
    const user = auth.currentUser;
    if (!user || orderedIds.length === 0) return false;

    const docRef = doc(db, "watchlists", user.uid);
    const newItemsMap = {};
    const currentList = getLocalWatchlist();

    orderedIds.forEach((itemId, index) => {
        const currentItem = currentList.get(itemId);
        if (currentItem) {
            newItemsMap[itemId] = {
                status: currentItem.status,
                order: index,
                // Preserve rating on reorder
                ...(currentItem.userRating && { userRating: currentItem.userRating })
            };
        }
    });

    try {
        await updateDoc(docRef, { items: newItemsMap });
        localWatchlist = new Map(Object.entries(newItemsMap).sort(([, a], [, b]) => a.order - b.order));
        return true;
    } catch (e) {
        console.error("Error updating watchlist order:", e);
        return false;
    }
}

export function updateWatchlistIcon(mediaId, mediaType) {
    document.querySelectorAll(`[data-id="${mediaId}"][data-type="${mediaType}"]`).forEach(container => {
        const itemData = localWatchlist.get(`${mediaType}:${mediaId}`);
        const status = itemData ? itemData.status : null;
        const userRating = itemData ? itemData.userRating : null;
        
        // Handle 4-button system on media cards
        const watchlistBtn = container.querySelector('.action-button[data-status="watchlist"]');
        if (watchlistBtn) { 
            const watchedBtn = container.querySelector('.action-button[data-status="watched"]');
            const hiddenBtn = container.querySelector('.action-button[data-status="not_interested"]');
            
            const buttons = [
                { el: watchlistBtn, status: 'watchlist', icon: 'bookmark' },
                { el: watchedBtn, status: 'watched', icon: 'circle-check' },
                { el: hiddenBtn, status: 'not_interested', icon: 'eye-slash' }
            ];

            buttons.forEach(btnInfo => {
                if (btnInfo.el) {
                    const iconEl = btnInfo.el.querySelector('i');
                    if (status === btnInfo.status) {
                        btnInfo.el.classList.add('active');
                        iconEl.className = `fa-solid fa-${btnInfo.icon}`;
                    } else {
                        btnInfo.el.classList.remove('active');
                        iconEl.className = `fa-regular fa-${btnInfo.icon}`;
                    }
                }
            });

            // Handle rating button
            const rateBtn = container.querySelector('.action-button[data-action="rate"]');
            if (rateBtn) {
                const iconEl = rateBtn.querySelector('i');
                if (userRating) {
                    rateBtn.setAttribute('aria-label', `Your rating: ${userRating}/10`);
                    iconEl.className = 'fa-solid fa-star';
                } else {
                    rateBtn.setAttribute('aria-label', 'Rate');
                    iconEl.className = 'fa-regular fa-star';
                }
            }
            return; 
        }

        // Handle single-button system on hero pages
        const singleButton = container.querySelector('.watchlist-toggle');
        if (singleButton) {
            const icon = singleButton.querySelector('i');
            const text = singleButton.querySelector('.watchlist-btn-text');
            
            singleButton.classList.remove('saved', 'watched', 'not-interested');
            icon.className = 'fa-regular fa-bookmark';
            if (text) text.textContent = 'Add to List';

            switch (status) {
                case 'watchlist':
                    singleButton.classList.add('saved');
                    icon.className = 'fa-solid fa-bookmark';
                    if (text) text.textContent = 'On Watchlist';
                    break;
                case 'watched':
                    singleButton.classList.add('watched');
                    icon.className = 'fa-solid fa-circle-check';
                    if (text) text.textContent = 'Watched';
                    break;
                case 'not_interested':
                    singleButton.classList.add('not-interested');
                    icon.className = 'fa-solid fa-eye-slash';
                    if (text) text.textContent = 'Hidden';
                    break;
            }
        }
    });
}


export function updateAllWatchlistIcons() {
    // Update all media cards
    document.querySelectorAll('.media-card').forEach(card => {
        const { id, type } = card.dataset;
        if (id && type) {
            updateWatchlistIcon(id, type);
        }
    });
    // Update hero watchlist button if it exists
    const heroBtn = document.getElementById('hero-watchlist-btn');
    if (heroBtn) {
        const { id, type } = heroBtn.dataset;
        if (id && type) {
            updateWatchlistIcon(id, type);
        }
    }
}