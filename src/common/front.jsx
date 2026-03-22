import { useState } from "react";

export function debounce (duration) {
    let timer = null;
    return {
        run: cb => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                cb();
            }, duration);
        },
        clear: () => timer?clearTimeout(timer):null,
    }
}

export function useLocalStorage(key, def) {
    let stored;
    try {
        stored = JSON.parse(localStorage.getItem(key));
    } catch {}
    if (stored===undefined || stored===null) stored = def;
    const [ val, set ] = useState(stored);
    return [ val, new_val => {
        localStorage.setItem(key, JSON.stringify(new_val));
        set(new_val);
    }];
}

