export interface FormField {
    id: string;
    label: string;
    type: string;
    required: boolean;
    verification_config?: {
        enabled: boolean;
        source: 'API' | 'MANUAL';
        platform: string;
        targets: string[];
        enable_client_fetch: boolean;
        retry_policy?: { max_attempts: number, block_on_private: boolean };
        max_retries?: number;
    };
    validation?: {
        regex?: string;
        min_length?: number;
        max_length?: number;
    };
    logic?: {
        criteria: Array<{
            metric: string;
            operator: string;
            threshold: number;
        }>;
    };
    retry_policy?: {
        max_attempts: number;
        block_on_private: boolean;
    };
}

export type Candidate = {
    id: string;
    form_id: string;
    name: string;
    email?: string;
    submitted_at: string;
    status: 'pending' | 'verified' | 'failed';
    responses: Record<string, any>; // The new Unified JSON layout
    verification_result?: any;
    snapshot?: any;
    verdict?: 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING';
    verdict_overrides?: Record<string, 'ELIGIBLE' | 'INELIGIBLE'>;
    flag_status?: 'flagged' | null;
    flag_message?: string | null;
    flag_fields?: string[] | null;
    overrides?: Record<string, any>;
}

export interface FormConfig {
    meta: {
        title: string;
        description: string;
    };
    access_control?: {
        mode: "PUBLIC" | "DOMAIN_RESTRICTED" | "REGEX_MATCH" | "ALLOWLIST";
        rules?: {
            allowed_domains?: string[];
            regex_pattern?: string;
        };
    };
    submission_policy?: {
        mode: "SINGLE_SHOT" | "SINGLE_EDITABLE" | "UNLIMITED";
    };
    post_submit_behavior?: {
        custom_message?: string;
    };
}

export * from './capabilities';
