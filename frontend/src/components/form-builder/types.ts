export interface FormSettings {
    meta?: {
        title?: string;
        description?: string;
        logo_url?: string;
    };
    organization: {
        name: string;
        logo_url: string;
    };
    access_control: {
        mode: 'PUBLIC' | 'DOMAIN_RESTRICTED' | 'ALLOWLIST' | 'REGEX_MATCH';
        rules: {
            allowed_domains?: string[];
            regex_pattern?: string;
        };
        block_message: string;
    };
    submission_policy: {
        mode: 'SINGLE_LOCK' | 'SINGLE_EDITABLE' | 'UNLIMITED';
    };
    respondent_experience: {
        show_identity_card: boolean;
    };
    post_submit_behavior: {
        show_scorecard: boolean;
        show_verdict: boolean;
        custom_message: string;
        redirect_url?: string | null;
    };
}
