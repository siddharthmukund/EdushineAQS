/**
 * useConfigStatus — fetches /api/config/status once on mount.
 * Returns whether any LLM provider is configured and a refresh function.
 */
import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface LLMStatus {
    anthropic: boolean;
    openai: boolean;
    gemini: boolean;
    any_configured: boolean;
    active_model: string;
}

export interface ConfigStatus {
    llm: LLMStatus;
}

export function useConfigStatus() {
    const [status, setStatus] = useState<ConfigStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/config/status`);
            if (res.ok) setStatus(await res.json());
        } catch {
            // If unreachable, keep status null — don't block the UI
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const anyConfigured = status?.llm?.any_configured ?? true; // optimistic default until loaded

    return { status, loading, anyConfigured, refresh };
}
