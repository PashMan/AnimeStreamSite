const CACHE_PREFIX = 'as_cache_';

export const getFromStorage = (key: string) => {
    try {
        const item = localStorage.getItem(CACHE_PREFIX + key);
        if (item) return JSON.parse(item);
    } catch (e) { return null; }
    return null;
};

export const saveToStorage = (key: string, data: any) => {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (e) {
        // If quota exceeded, clear old cache
        try {
            const now = Date.now();
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) {
                    try {
                        const item = JSON.parse(localStorage.getItem(k) || '{}');
                        if (now - (item.timestamp || 0) > 60 * 60 * 1000) {
                            localStorage.removeItem(k);
                        }
                    } catch (e) {}
                }
            }
            
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch(e2) {
             // If still full, clear all
             try { localStorage.clear(); } catch (e3) {}
        }
    }
};
