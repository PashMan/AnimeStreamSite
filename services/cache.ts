import { safeLocalStorage } from './safeStorage';

export const CACHE_PREFIX = 'as_cache_';

export const getFromStorage = (key: string) => {
    try {
        const item = safeLocalStorage.getItem(CACHE_PREFIX + key);
        if (item) {
            const parsed = JSON.parse(item);
            // Check if data is older than 1 hour
            if (Date.now() - (parsed.timestamp || 0) < 60 * 60 * 1000) {
                return parsed;
            } else {
                safeLocalStorage.removeItem(CACHE_PREFIX + key);
            }
        }
    } catch (e) { return null; }
    return null;
};

export const saveToStorage = (key: string, data: any) => {
    try {
        safeLocalStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (e) {
        // If quota exceeded, clear old cache
        try {
            const now = Date.now();
            for (let i = 0; i < safeLocalStorage.length; i++) {
                const k = safeLocalStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) {
                    try {
                        const item = JSON.parse(safeLocalStorage.getItem(k) || '{}');
                        if (now - (item.timestamp || 0) > 60 * 60 * 1000) {
                            safeLocalStorage.removeItem(k);
                        }
                    } catch (e) {}
                }
            }
            
            safeLocalStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch(e2) {
             // If still full, clear all
             try { safeLocalStorage.clear(); } catch (e3) {}
        }
    }
};
