
import { useState, Dispatch, SetStateAction, useCallback } from 'react';

export const useLocalStorage = <T,>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] => {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    const setValue: Dispatch<SetStateAction<T>> = useCallback((value) => {
        setStoredValue((currentValue) => {
            try {
                const valueToStore = value instanceof Function ? value(currentValue) : value;
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(key, JSON.stringify(valueToStore));
                }
                return valueToStore;
            } catch (error) {
                console.error(`Error setting localStorage key "${key}":`, error);
                return currentValue;
            }
        });
    }, [key]);

    return [storedValue, setValue];
};
