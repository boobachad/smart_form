package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// --- Bitmask Roles ---
const (
	RoleStandard uint32 = 1 << iota // 1
	RoleCreator                     // 2
	RoleAdmin                       // 4
)

// --- Table Models ---

type User struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	FirebaseUID string    `json:"firebase_uid"`
	Role        uint32    `json:"role"` // Bitmask: 1=STANDARD, 2=CREATOR, etc.
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Form struct {
	ID                 uuid.UUID   `json:"id"`
	UserID             uuid.UUID   `json:"user_id"`
	Title              string      `json:"title"`
	Status             string      `json:"status"`              // active, closed
	VerificationStatus string      `json:"verification_status"` // idle, in_progress, completed
	Fields             []FormField `json:"fields"`              // JSONB
	Config             FormConfig  `json:"config"`              // JSONB
	CreatedAt          time.Time   `json:"created_at"`
	UpdatedAt          time.Time   `json:"updated_at"`
}

type Submission struct {
	ID                 uuid.UUID       `json:"id"`
	FormID             uuid.UUID       `json:"form_id"`
	VerificationStatus string          `json:"verification_status"` // pending, verified, flagged
	Verdict            string          `json:"verdict"`             // pending, eligible, ineligible
	Responses          json.RawMessage `json:"responses"`
	SubmittedAt        time.Time       `json:"submitted_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

type UnifiedFieldState struct {
	ClaimedValue string                  `json:"claimed_value"`
	ClaimedStats map[string]any          `json:"claimed_stats,omitempty"`
	Source       string                  `json:"source"`
	Verification *FieldVerificationState `json:"verification,omitempty"`
}

type FieldVerificationState struct {
	Status        string         `json:"status"`
	VerifiedStats map[string]any `json:"verified_stats,omitempty"`
	Verdict       string         `json:"verdict"`
	VerifiedAt    time.Time      `json:"verified_at"`
}

// --- JSONB Structure Definitions ---

// FormField defines the strict schema for "Smart" logic.
type FormField struct {
	ID                 string              `json:"id"`
	Type               string              `json:"type"` // smart_field, text, etc.
	Label              string              `json:"label"`
	VerificationConfig *VerificationConfig `json:"verification_config,omitempty"`
	Logic              *LogicConfig        `json:"logic,omitempty"`
	Validation         *ValidationConfig   `json:"validation,omitempty"`
	Required           bool                `json:"required"`
}

type VerificationConfig struct {
	Source            string   `json:"source"`   // API, MANUAL
	Platform          string   `json:"platform"` // leetcode, codeforces, github
	Targets           []string `json:"targets"`  // rating, solved_count
	RetryPolicy       *Retry   `json:"retry_policy,omitempty"`
	MaxRetries        int      `json:"max_retries,omitempty"`
	EnableClientFetch bool     `json:"enable_client_fetch"`
}

type Retry struct {
	MaxAttempts    int  `json:"max_attempts"`
	BlockOnPrivate bool `json:"block_on_private"`
}

type LogicConfig struct {
	Criteria []Criterion `json:"criteria"`
}

type Criterion struct {
	Metric    string  `json:"metric"`    // rating
	Operator  string  `json:"operator"`  // gte, eq
	Threshold float64 `json:"threshold"` // 1500
}

type ValidationConfig struct {
	Regex     string `json:"regex,omitempty"`
	MinLength int    `json:"min_length,omitempty"`
}

type FormConfig struct {
	Meta                 FormMeta              `json:"meta"`
	Organization         Organization          `json:"organization"`
	AccessControl        AccessControl         `json:"access_control"`
	SubmissionPolicy     SubmissionPolicy      `json:"submission_policy"`
	PostSubmitBehavior   PostSubmitBehavior    `json:"post_submit_behavior"`
	RespondentExperience *RespondentExperience `json:"respondent_experience,omitempty"`
}

type RespondentExperience struct {
	ShowIdentityCard bool `json:"show_identity_card"`
}

type FormMeta struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	LogoURL     string `json:"logo_url,omitempty"`
}

type Organization struct {
	Name    string `json:"name,omitempty"`
	LogoURL string `json:"logo_url"` // Required
}

type AccessControl struct {
	Mode         string `json:"mode"` // PUBLIC, RESTRICTED
	Rules        Rules  `json:"rules"`
	BlockMessage string `json:"block_message"`
}

type Rules struct {
	AllowedDomains []string `json:"allowed_domains"`
	RegexPattern   string   `json:"regex_pattern,omitempty"`
}

type SubmissionPolicy struct {
	Mode string `json:"mode"` // SINGLE_EDITABLE
}

type PostSubmitBehavior struct {
	CustomMessage string `json:"custom_message"`
	RedirectURL   string `json:"redirect_url,omitempty"`
	ShowScorecard bool   `json:"show_scorecard"`
	ShowVerdict   bool   `json:"show_verdict"`
}

// Removed VerdictOverride

// --- System Capabilities ---

type SystemCapability struct {
	DisplayName       string            `json:"display_name"`
	Status            string            `json:"status"` // OPERATIONAL, PARTIAL_OUTAGE, UNAVAILABLE
	UnavailableReason string            `json:"unavailable_reason,omitempty"`
	SupportedMetrics  []SupportedMetric `json:"supported_metrics"`
	Features          PlatformFeature   `json:"features"`
}

type PlatformFeature struct {
	ClientFetchSupported bool `json:"client_fetch_supported"`
}

type SupportedMetric struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Type  string `json:"type"` // number, string
}
