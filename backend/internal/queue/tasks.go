package queue

import (
	"time"

	"github.com/google/uuid"
)

// VerificationJobPayload represents the job data structure.
type VerificationJobPayload struct {
	JobID string `json:"job_id"`

	// Scope: WHO to verify
	Scope struct {
		Type          string   `json:"type"`           // ALL_PENDING, ALL, SELECTIVE
		SubmissionIDs []string `json:"submission_ids"` // UUIDs
	} `json:"scope"`

	// Targets: WHAT fields to verify
	Targets struct {
		Type     string   `json:"type"`      // ALL_SMART_FIELDS, SELECTIVE
		FieldIDs []string `json:"field_ids"` // e.g., ["f_smart_lc_rating"]
	} `json:"targets"`

	// Strategy: HOW to verify
	Strategy struct {
		Freshness   string `json:"freshness"` // LIVE_FETCH
		IgnoreCache bool   `json:"ignore_cache"`
	} `json:"strategy"`

	// Priority: Which queue tier (determines locking behavior)
	Priority string `json:"priority"` // "interactive", "admin_now", or "batch"

	// Metadata
	FormID    string    `json:"form_id"`
	Platform  string    `json:"platform"` // leetcode, codeforces, github
	CreatedAt time.Time `json:"created_at"`

	// Simulation Mode fields (when no submission_ids)
	Handle             string   `json:"handle,omitempty"`              // Username/handle to verify
	SimulationPlatform string   `json:"simulation_platform,omitempty"` // Override platform for sim
	SimulationTargets  []string `json:"simulation_targets,omitempty"`  // Allowed metrics
}

// NewVerificationJob creates a new verification job payload.
func NewVerificationJob(formID, platform string, submissionIDs, fieldIDs []string) *VerificationJobPayload {
	job := &VerificationJobPayload{
		JobID:     uuid.New().String(),
		FormID:    formID,
		Platform:  platform,
		CreatedAt: time.Now(),
	}

	// Set scope
	job.Scope.Type = "SELECTIVE"
	job.Scope.SubmissionIDs = submissionIDs

	// Set targets
	if len(fieldIDs) == 0 {
		job.Targets.Type = "ALL_SMART_FIELDS"
	} else {
		job.Targets.Type = "SELECTIVE"
		job.Targets.FieldIDs = fieldIDs
	}

	// Set strategy
	job.Strategy.Freshness = "LIVE_FETCH"
	job.Strategy.IgnoreCache = true

	return job
}
