import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnalysisResult } from '../types/api';
import { offlineStorage } from '../services/offlineStorage';

interface AnalysisState {
    currentAnalysis: AnalysisResult | null;
    history: AnalysisResult[];
    isLoading: boolean;
    error: string | null;

    setCurrentAnalysis: (result: AnalysisResult | null) => void;
    addToHistory: (result: AnalysisResult) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    loadHistoryFromDB: () => Promise<void>;
}

export const useAnalysisStore = create<AnalysisState>()(
    persist(
        (set) => ({
            currentAnalysis: null,
            history: [],
            isLoading: false,
            error: null,

            setCurrentAnalysis: (result) => set({ currentAnalysis: result }),

            addToHistory: (result) => {
                set((state) => {
                    // Check if already in history to avoid duplication
                    const exists = state.history.some(item => item.id === result.id);
                    if (exists) return state;

                    const newHistory = [result, ...state.history].slice(0, 50); // Keep last 50
                    return { history: newHistory };
                });

                // Also save to IndexedDB asynchronously
                offlineStorage.saveAnalysis(result).catch(err =>
                    console.error('Failed to save to offline storage:', err)
                );
            },

            setLoading: (loading) => set({ isLoading: loading }),

            setError: (error) => set({ error }),

            loadHistoryFromDB: async () => {
                try {
                    const stored = await offlineStorage.getAllAnalyses();
                    if (stored.length > 0) {
                        set({ history: stored.slice(0, 50) });
                    }
                } catch (err) {
                    console.error("Failed to load history from DB", err);
                }
            }
        }),
        {
            name: 'cv-analysis-ui-state',
            partialize: (state) => ({ history: state.history }), // Only persist recent history to local storage as fallback
        }
    )
);
