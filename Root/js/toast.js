export function showToast(options) {
    const { message, type = 'info', duration = 5000, onUndo = null, actions = [] } =
        typeof options === 'string' ? { message: options } : options;

    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let toastContent = `<span>${message}</span>`;
    
    if (onUndo) {
        toastContent += `<button class="toast-btn toast-undo-btn">Undo</button>`;
    }
    
    if (actions.length > 0) {
        toastContent += actions.map(action => 
            `<button class="toast-btn ${action.className || ''}">${action.text}</button>`
        ).join('');
    }

    toast.innerHTML = toastContent;
    container.appendChild(toast);

    let timeoutId;

    const removeToast = () => {
        // Prevent removal if it's already being removed
        if (!toast.parentElement) return;
        
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentElement) {
                container.removeChild(toast);
            }
        });
        clearTimeout(timeoutId);
    };
    
    if (onUndo) {
        const undoButton = toast.querySelector('.toast-undo-btn');
        if (undoButton) {
            undoButton.addEventListener('click', (e) => {
                e.stopPropagation();
                onUndo();
                removeToast();
            });
        }
    }

    if (actions.length > 0) {
        const actionButtons = toast.querySelectorAll('.toast-btn:not(.toast-undo-btn)');
        actionButtons.forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (actions[index].callback) {
                    actions[index].callback();
                }
                removeToast();
            });
        });
    }


    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Set timer to remove
    timeoutId = setTimeout(removeToast, duration);
}