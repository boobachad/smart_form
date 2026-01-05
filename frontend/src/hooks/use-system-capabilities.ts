import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/auth-client";
import type { SystemCapabilities } from "@/types/capabilities";

export function useSystemCapabilities() {
    const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const fetchCapabilities = async () => {
            try {
                // Ensure the backend endpoint matches implementation
                const data = await apiRequest("/system/capabilities");
                setCapabilities(data as SystemCapabilities); // Expecting Record<string, SystemCapability> directly
            } catch (err: unknown) {
                console.error("Failed to fetch system capabilities:", err);
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        };

        fetchCapabilities();
    }, []);

    return { capabilities, loading, error };
}
