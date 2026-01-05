package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/boobachad/smart_form/backend/internal/db"
	"github.com/boobachad/smart_form/backend/internal/domain"
	"github.com/boobachad/smart_form/backend/internal/queue"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EnqueueVerificationRequest defines the request body for batch verification.
type EnqueueVerificationRequest struct {
	SubmissionIDs []string `json:"submission_ids"` // Empty for simulation mode
	FieldIDs      []string `json:"field_ids"`      // Optional: selective verification
	Priority      string   `json:"priority"`       // "interactive", "admin_now" or "batch"

	// Simulation mode fields (when submission_ids is empty)
	Handle   string `json:"handle"`   // Username to verify
	Platform string `json:"platform"` // Platform (leetcode, codeforces, github)
}

// POST /api/v1/forms/:id/verify-async.
func EnqueueVerification(c *gin.Context) {
	processVerificationEnqueue(c, false)
}

// POST /api/v1/forms/:id/verify-preview.
func EnqueueVerificationPreview(c *gin.Context) {
	processVerificationEnqueue(c, true)
}

func processVerificationEnqueue(c *gin.Context, isPreview bool) {
	formID := c.Param("id")

	realUserID, isOwner, err := validateVerificationAuth(c, formID, isPreview)
	if err != nil {
		return
	}

	req, err := parseVerificationRequest(c, isPreview, isOwner)
	if err != nil {
		return
	}

	conn := db.GetPool()
	fieldsBytes, formConfig, err := loadFormForVerification(c, conn, formID, isPreview)
	if err != nil {
		return
	}

	if policyErr := enforceVerificationPolicy(c, conn, req, formConfig, fieldsBytes, formID, realUserID, isPreview, isOwner); policyErr != nil {
		return
	}

	platform, targets := determineVerificationPlatform(fieldsBytes, req.FieldIDs)

	payload := buildVerificationPayload(formID, platform, targets, req, isPreview)
	jobID := uuid.MustParse(payload.JobID)

	if insertErr := insertVerificationJob(c.Request.Context(), conn, jobID, payload, req); insertErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create job record"})
		return
	}

	taskID, err := enqueueVerificationJob(platform, payload, req, isPreview)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enqueue job: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Verification job enqueued successfully",
		"job_id":   payload.JobID,
		"task_id":  taskID,
		"status":   "QUEUED",
		"priority": req.Priority,
		"mode":     payload.Scope.Type,
	})
}

func validateVerificationAuth(c *gin.Context, formID string, isPreview bool) (*uuid.UUID, bool, error) {
	realUserID, err := ResolveUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return nil, false, err
	}

	conn := db.GetPool()
	var ownerID string
	err = conn.QueryRow(c.Request.Context(), "SELECT user_id FROM forms WHERE id = $1", formID).Scan(&ownerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return nil, false, err
	}

	isOwner := ownerID == realUserID.String()
	if isPreview && !isOwner {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only form owner can access preview mode"})
		return nil, false, fmt.Errorf("forbidden")
	}

	return realUserID, isOwner, nil
}

func parseVerificationRequest(c *gin.Context, isPreview, isOwner bool) (EnqueueVerificationRequest, error) {
	var req EnqueueVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return req, err
	}

	if req.Priority == "" {
		req.Priority = "batch"
	}

	if req.Priority != "interactive" && req.Priority != "admin_now" && req.Priority != "batch" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Priority must be 'interactive', 'admin_now', or 'batch'"})
		return req, fmt.Errorf("invalid priority")
	}

	if !isPreview {
		if !isOwner && req.Priority != "interactive" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only form owner can run batch verification"})
			return req, fmt.Errorf("forbidden")
		}
	} else {
		req.Priority = "interactive"
	}

	return req, nil
}

func loadFormForVerification(c *gin.Context, conn *pgxpool.Pool, formID string, isPreview bool) ([]byte, domain.FormConfig, error) {
	var fieldsBytes []byte
	var configBytes []byte
	var formStatus string
	var formConfig domain.FormConfig

	err := conn.QueryRow(c.Request.Context(), "SELECT fields, config, status FROM forms WHERE id = $1", formID).Scan(&fieldsBytes, &configBytes, &formStatus)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load form data"})
		return nil, formConfig, err
	}

	if !isPreview && formStatus != "active" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Form is not currently active"})
		return nil, formConfig, fmt.Errorf("inactive form")
	}

	if err := json.Unmarshal(configBytes, &formConfig); err != nil {
		slog.Warn("[EnqueueVerification] failed to parse configBytes", "error", err)
	}

	return fieldsBytes, formConfig, nil
}

func enforceVerificationPolicy(c *gin.Context, conn *pgxpool.Pool, req EnqueueVerificationRequest, formConfig domain.FormConfig, fieldsBytes []byte, formID string, realUserID *uuid.UUID, isPreview, isOwner bool) error {
	if !isPreview && !isOwner && req.Priority == "interactive" {
		if formConfig.SubmissionPolicy.Mode == "SINGLE_SHOT" {
			var existingID, flagStatus string
			err := conn.QueryRow(c.Request.Context(),
				"SELECT id, COALESCE(flag_status, '') FROM submissions WHERE form_id = $1 AND user_id = $2 ORDER BY submitted_at DESC LIMIT 1",
				formID, realUserID).Scan(&existingID, &flagStatus)

			if err == nil && existingID != "" && flagStatus != "flagged" {
				c.JSON(http.StatusForbidden, gin.H{"error": "You have already submitted this form. Verification is disabled."})
				return fmt.Errorf("single shot enforced")
			}
		}
	}

	if !isPreview && req.Priority == "interactive" && req.Handle != "" {
		return enforceRateLimit(c, formID, req, fieldsBytes, realUserID)
	}
	return nil
}

func enforceRateLimit(c *gin.Context, formID string, req EnqueueVerificationRequest, fieldsBytes []byte, realUserID *uuid.UUID) error {
	var fields []struct {
		ID          string `json:"id"`
		RetryPolicy *struct {
			MaxAttempts int `json:"max_attempts"`
		} `json:"retry_policy"`
	}
	if err := json.Unmarshal(fieldsBytes, &fields); err != nil {
		slog.Warn("[EnqueueVerification] failed to parse fieldsBytes for rate limit", "error", err)
	}

	fieldID := "default"
	maxAttempts := 3

	if len(req.FieldIDs) > 0 {
		fieldID = req.FieldIDs[0]
		for _, field := range fields {
			if field.ID == fieldID && field.RetryPolicy != nil {
				maxAttempts = field.RetryPolicy.MaxAttempts
				break
			}
		}
	}

	currentCount, err := CheckAndIncrementFetchAttempt(c.Request.Context(), formID, fieldID, realUserID, "", c.GetHeader("X-Idempotency-Key"))
	if err != nil {
		slog.Error("[RATE_LIMIT] Platform rate limit check failed", "error", err)
	} else if currentCount > maxAttempts {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":              "Platform rate limit exceeded - too many fetch attempts",
			"attempts_remaining": 0,
			"max_attempts":       maxAttempts,
			"limit_type":         "PLATFORM_FETCH_LIMIT",
		})
		return fmt.Errorf("rate limited")
	}
	return nil
}

func determineVerificationPlatform(fieldsBytes []byte, targetFieldIDs []string) (string, []string) {
	var fields []struct {
		ID                 string `json:"id"`
		VerificationConfig *struct {
			Platform string   `json:"platform"`
			Targets  []string `json:"targets"`
		} `json:"verification_config"`
	}
	if err := json.Unmarshal(fieldsBytes, &fields); err != nil {
		slog.Warn("[EnqueueVerification] failed to parse fieldsBytes", "error", err)
	}

	targetMap := make(map[string]bool)
	for _, id := range targetFieldIDs {
		targetMap[id] = true
	}

	for _, field := range fields {
		if field.VerificationConfig != nil && field.VerificationConfig.Platform != "" {
			if len(targetMap) == 0 || targetMap[field.ID] {
				return field.VerificationConfig.Platform, field.VerificationConfig.Targets
			}
		}
	}
	return "leetcode", nil
}

func buildVerificationPayload(formID, platform string, targets []string, req EnqueueVerificationRequest, isPreview bool) *queue.VerificationJobPayload {
	payload := queue.NewVerificationJob(formID, platform, req.SubmissionIDs, req.FieldIDs)
	payload.Priority = req.Priority
	if req.Handle != "" {
		payload.Handle = req.Handle
	}
	if req.Platform != "" {
		payload.SimulationPlatform = req.Platform
	}
	if targets != nil {
		payload.SimulationTargets = targets
	}
	if isPreview {
		payload.Strategy.Freshness = "LIVE_FETCH"
		payload.Strategy.IgnoreCache = true
	}
	return payload
}

func insertVerificationJob(ctx context.Context, conn *pgxpool.Pool, jobID uuid.UUID, payload *queue.VerificationJobPayload, req EnqueueVerificationRequest) error {
	_, err := conn.Exec(ctx, `
		INSERT INTO verification_jobs (
			id, status, priority, 
			scope_type, scope_submission_ids,
			targets_type, targets_field_ids,
			strategy_freshness, strategy_ignore_cache
		) VALUES ($1, 'QUEUED', $2, $3, $4, $5, $6, $7, $8)
	`, jobID, getPriorityInt(req.Priority), payload.Scope.Type, req.SubmissionIDs,
		payload.Targets.Type, req.FieldIDs, payload.Strategy.Freshness, payload.Strategy.IgnoreCache)
	return err
}

func enqueueVerificationJob(platform string, payload *queue.VerificationJobPayload, req EnqueueVerificationRequest, isPreview bool) (string, error) {
	if isPreview || req.Priority == "interactive" {
		return queue.EnqueueInteractive(platform, payload)
	} else if req.Priority == "admin_now" {
		return queue.EnqueueAdminNow(platform, payload)
	}
	return queue.EnqueueBatch(platform, payload)
}

// GET /api/v1/jobs/:id/status.
func GetJobStatus(c *gin.Context) {
	jobID := c.Param("id")

	conn := db.GetPool()

	var status string
	var priority int
	var createdAt, startedAt, completedAt interface{}
	var errorMessage sql.NullString // NULL when no error
	var result sql.NullString       // Use NullString for nullable JSONB

	err := conn.QueryRow(c.Request.Context(), `
		SELECT status, priority, error_message, created_at, started_at, completed_at, result
		FROM verification_jobs
		WHERE id = $1
	`, jobID).Scan(&status, &priority, &errorMessage, &createdAt, &startedAt, &completedAt, &result)

	if err != nil {
		slog.Error("[GetJobStatus] Query failed", "jobID", jobID, "error", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
		return
	}

	// slog.Info("[GetJobStatus] Successfully retrieved job", "jobID", jobID, "status", status)

	response := gin.H{
		"job_id":       jobID,
		"status":       status,
		"priority":     priority,
		"created_at":   createdAt,
		"started_at":   startedAt,
		"completed_at": completedAt,
	}

	if errorMessage.Valid && errorMessage.String != "" {
		response["error_message"] = errorMessage.String
	}

	// Include result if present (simulation mode)
	if result.Valid && result.String != "" {
		var resultData map[string]interface{}
		if err := json.Unmarshal([]byte(result.String), &resultData); err == nil {
			response["result"] = resultData
		}
	}

	c.JSON(http.StatusOK, response)
}

// Helper to convert priority string to int.
func getPriorityInt(priority string) int {
	switch priority {
	case "interactive":
		return 3
	case "admin_now":
		return 2
	case "batch":
		return 1
	default:
		return 1
	}
}
