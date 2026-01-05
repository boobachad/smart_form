import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { apiRequest } from '@/lib/auth-client';

interface JobStatus {
    job_id: string;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    priority: number;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    error_message?: string;
    result?: unknown; // Verification result for simulation mode
}

interface UseJobPollingOptions {
    onComplete?: (status: JobStatus) => void;
    onError?: (error: string) => void;
    pollInterval?: number; // milliseconds
}

export function useJobPolling(jobId: string | null, options: UseJobPollingOptions = {}) {
    const { onComplete, onError, pollInterval = 2000 } = options;

    const [status, setStatus] = useState<JobStatus | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const notFoundRetries = useRef(0);
    const MAX_RETRIES = 5;

    // Use refs for callbacks to avoid re-triggering polling on render
    const onCompleteRef = useRef(onComplete);
    const onErrorRef = useRef(onError);

    useLayoutEffect(() => {
        onCompleteRef.current = onComplete;
        onErrorRef.current = onError;
    }, [onComplete, onError]);

    const pollStatus = useCallback(async () => {
        if (!jobId) return;

        try {
            const data = await apiRequest(`/jobs/${jobId}/status`);
            notFoundRetries.current = 0; // Reset on success
            setStatus(data as JobStatus);

            if ((data as JobStatus).status === 'COMPLETED') {
                setIsPolling(false);
                onCompleteRef.current?.(data as JobStatus); // Pass fresh data to callback
            } else if ((data as JobStatus).status === 'FAILED') {
                setIsPolling(false);
                const errorMsg = (data as JobStatus).error_message || 'Verification failed';
                setError(errorMsg);
                onErrorRef.current?.(errorMsg);
            }
        } catch (err: unknown) {
            // Check if it's a 404 error
            const is404 = (err as Error).message?.includes('not found') || (err as Error).message?.includes('Not Found');

            if (is404 && notFoundRetries.current < MAX_RETRIES) {
                notFoundRetries.current++;
                console.log(`Job not found yet, retry ${notFoundRetries.current}/${MAX_RETRIES}`);
                return; // Continue polling
            }

            // Max retries reached or non-404 error
            console.error('Failed to poll job status:', err);
            const errorMsg = is404 ? 'Job creation timed out' : ((err as Error).message || 'Failed to check job status');
            setError(errorMsg);
            setIsPolling(false);
            onErrorRef.current?.(errorMsg);
        }
    }, [jobId]); // Only depend on jobId now

    // Start polling when jobId changes
    useEffect(() => {
        if (!jobId) {
            setIsPolling(false);
            setStatus(null);
            setError(null);
            return;
        }

        setIsPolling(true);
        setError(null);

        // Initial poll
        pollStatus();

        // Set up interval
        const intervalId = setInterval(pollStatus, pollInterval);

        return () => clearInterval(intervalId);
    }, [jobId, pollStatus, pollInterval]);

    return {
        status,
        isPolling,
        error,
        isWaiting: status?.status === 'QUEUED' || status?.status === 'PROCESSING',
        isCompleted: status?.status === 'COMPLETED',
        isFailed: status?.status === 'FAILED',
    };
}
