-- Seed Script for Demo User and Sample Form

-- 1. Upsert Demo User
INSERT INTO users (email, role, firebase_uid) 
VALUES ('demo@smartforms.com', 'CREATOR', 'demo_firebase_uid') 
ON CONFLICT (email) DO NOTHING;

-- 2. Insert Sample Form (using UUID of demo user)
WITH user_ref AS (
    SELECT id FROM users WHERE email = 'demo@smartforms.com' LIMIT 1
)
INSERT INTO forms (id, user_id, title, status, verification_status, fields, config)
SELECT 
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Fixed UUID for consistency
    user_ref.id, 
    'Batch Verification 2024',
    'active',
    'idle',
    -- Fields JSON (Based on MOCK_FORM_SCHEMA)
    '[
        { "id": "f_name", "label": "Full Name", "type": "text", "required": true },
        { "id": "f_enrollment", "label": "Enrollment No.", "type": "text", "required": true },
        { "id": "f_dob", "label": "Date of Birth", "type": "text", "required": true, "validation": { "regex": "^\\d{4}-\\d{2}-\\d{2}$" } },
        {
            "id": "f_smart_leetcode",
            "label": "LeetCode Profile",
            "type": "smart_field",
            "required": true,
            "verification_config": {
                "enabled": true,
                "source": "API",
                "platform": "leetcode",
                "targets": ["rating", "solved_count"],
                "enable_client_fetch": true
            },
            "logic": {
                "criteria": [
                    { "metric": "rating", "operator": "gte", "threshold": 1500 },
                    { "metric": "solved_count", "operator": "gte", "threshold": 300 }
                ]
            },
            "validation_behavior": { "max_retries": 3, "block_on_private": true }
        }
    ]'::jsonb,
    -- Config JSON (Based on MOCK_FORM_CONFIG)
    '{
        "meta": {
            "title": "Batch Verification 2024",
            "description": "Verify your competitive programming profiles.",
            "logo_url": "https://github.com/shadcn.png",
            "org_name": "Acme Corp"
        },
        "organization": { "logo_url": "https://github.com/shadcn.png", "name": "Acme Corp" },
        "access_control": { "mode": "PUBLIC", "rules": { "allowed_domains": [], "regex_pattern": "" }, "block_message": "" },
        "post_submit_behavior": { "redirect_url": null, "custom_message": "Done", "show_scorecard": true, "show_verdict": false }
    }'::jsonb
FROM user_ref
ON CONFLICT (id) DO UPDATE SET 
    fields = EXCLUDED.fields,
    config = EXCLUDED.config;
