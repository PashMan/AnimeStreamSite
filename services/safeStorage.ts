export const safeLocalStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage.getItem failed:', e);
            return null;
        }
    },
    setItem: (key: string, value: string): void => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('localStorage.setItem failed:', e);
        }
    },
    removeItem: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('localStorage.removeItem failed:', e);
        }
    },
    clear: (): void => {
        try {
            localStorage.clear();
        } catch (e) {
            console.warn('localStorage.clear failed:', e);
        }
    },
    get length(): number {
        try {
            return localStorage.length;
        } catch (e) {
            return 0;
        }
    },
    key: (index: number): string | null => {
        try {
            return localStorage.key(index);
        } catch (e) {
            return null;
        }
    }
};
