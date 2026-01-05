package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/boobachad/smart_form/backend/internal/db"
	"github.com/boobachad/smart_form/backend/internal/domain"
	"github.com/boobachad/smart_form/backend/internal/queue"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SubmitFormRequest: Expects generic JSON map for flexibility
// The frontend sends { "f_name": "...", "f_smart_leetcode": { "value": "..." } }

func SubmitForm(c *gin.Context) {
	formID := c.Param("id")

	var responses json.RawMessage
	if err := c.ShouldBindJSON(&responses); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON data"})
		return
	}

	userID, err := ResolveUserID(c)
	if err != nil || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required to submit"})
		return
	}

	conn := db.GetPool()
	form, fieldsBytes, err := fetchFormConfig(c.Request.Context(), conn, formID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	if form.Status != "active" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Form is closed"})
		return
	}

	if unmarshalErr := json.Unmarshal(fieldsBytes, &form.Fields); unmarshalErr != nil {
		slog.Warn("[SubmitForm] Failed to unmarshal fields", "error", unmarshalErr)
	}

	if !verifySubmitAccess(c, userID, form.Config.AccessControl) {
		return
	}

	policyMode := form.Config.SubmissionPolicy.Mode
	if policyMode == "" {
		policyMode = "SINGLE_EDITABLE"
	}

	slog.Info("[SubmitForm] Evaluating policy", "policy", policyMode, "user_id", userID, "form_id", formID)

	if isDuplicateSubmission(c.Request.Context(), conn, formID, userID.String()) {
		c.JSON(http.StatusConflict, gin.H{"error": "Duplicate submission detected. Please wait a moment before resubmitting."})
		return
	}

	subID, finalVerdict, finalStatus, submitErr := processSubmissionPolicyAndUpdate(c, conn, formID, userID, policyMode, responses)
	if submitErr != nil {
		return
	}

	if resetErr := ResetFetchAttempts(c.Request.Context(), formID, userID, ""); resetErr != nil {
		slog.Error("[SubmitForm] Failed to reset fetch attempts", "error", resetErr)
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":             "Submission received",
		"submission_id":       subID,
		"verdict":             finalVerdict,
		"verification_status": finalStatus,
	})
}

func processSubmissionPolicyAndUpdate(c *gin.Context, conn *pgxpool.Pool, formID string, userID *uuid.UUID, policyMode string, responses json.RawMessage) (string, string, string, error) {
	shouldUpdate, existingID, isLocked, existingErr := evaluateSubmissionPolicy(c.Request.Context(), conn, formID, userID.String(), policyMode)
	if existingErr != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": existingErr.Error()})
		return "", "", "", existingErr
	}
	if isLocked {
		c.JSON(http.StatusLocked, gin.H{"error": "This submission is currently being verified. Please try again shortly."})
		return "", "", "", fmt.Errorf("submission locked")
	}

	verdict := "PENDING"
	verificationStatus := "pending"

	var subID string
	var finalVerdict string
	var finalStatus string
	var err error

	if shouldUpdate {
		subID, finalVerdict, finalStatus, err = updateSubmission(c.Request.Context(), conn, existingID, responses, verdict, verificationStatus)
	} else {
		subID, finalVerdict, finalStatus, err = createSubmission(c.Request.Context(), conn, formID, userID.String(), responses, verdict, verificationStatus)
	}

	if err != nil {
		if strings.Contains(err.Error(), "locked") {
			c.JSON(http.StatusLocked, gin.H{"error": err.Error()})
		} else {
			slog.Error("Database error during submission", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save submission"})
		}
		return "", "", "", err
	}

	return subID, finalVerdict, finalStatus, nil
}

func fetchFormConfig(ctx context.Context, pool *pgxpool.Pool, formID string) (domain.Form, []byte, error) {
	sqlForm := `SELECT fields, config, status FROM forms WHERE id = $1`
	var form domain.Form
	var fieldsBytes []byte
	var configBytes []byte

	err := pool.QueryRow(ctx, sqlForm, formID).Scan(&fieldsBytes, &configBytes, &form.Status)
	if err != nil {
		return form, nil, err
	}

	if len(configBytes) > 0 {
		if err := json.Unmarshal(configBytes, &form.Config); err != nil {
			slog.Warn("[SubmitForm] Failed to unmarshal config", "error", err)
		}
	}
	return form, fieldsBytes, nil
}

func verifySubmitAccess(c *gin.Context, userID *uuid.UUID, accessControl domain.AccessControl) bool {
	userEmail, err := getUserEmail(c.Request.Context(), userID)
	if err != nil {
		slog.Error("[SubmitForm] Failed to get user email", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify access"})
		return false
	}

	allowed, blockMessage := CheckAccessControl(accessControl, userEmail, false)
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": blockMessage})
		return false
	}
	return true
}

func isDuplicateSubmission(ctx context.Context, pool *pgxpool.Pool, formID string, userID string) bool {
	var recentID string
	dedupeErr := pool.QueryRow(ctx,
		`SELECT id FROM submissions 
		 WHERE form_id = $1 AND user_id = $2 
		 AND submitted_at > NOW() - INTERVAL '5 seconds'
		 ORDER BY submitted_at DESC LIMIT 1`,
		formID, userID).Scan(&recentID)

	if dedupeErr == nil && recentID != "" {
		slog.Warn("[SubmitForm] Duplicate submission blocked (within 5s)", "recent_id", recentID)
		return true
	}
	return false
}

func evaluateSubmissionPolicy(ctx context.Context, pool *pgxpool.Pool, formID string, userID string, policyMode string) (bool, string, bool, error) {
	var flaggedID string
	var flaggedVerdict string
	var flaggedIsLocked bool
	flagErr := pool.QueryRow(ctx,
		`SELECT id, COALESCE(verdict, ''), COALESCE(is_locked_for_verification, false) 
		 FROM submissions 
		 WHERE form_id = $1 AND user_id = $2 AND flag_status = 'flagged'
		 ORDER BY submitted_at DESC LIMIT 1`,
		formID, userID).Scan(&flaggedID, &flaggedVerdict, &flaggedIsLocked)

	if flagErr == nil && flaggedID != "" {
		slog.Info("[SubmitForm] Found flagged submission (correction mode)", "submission_id", flaggedID)
		return true, flaggedID, flaggedIsLocked, nil
	}

	if policyMode != "UNLIMITED" {
		var existingID string
		var existingFlagStatus *string
		var existingVerdict string

		var isLocked bool

		scanErr := pool.QueryRow(ctx,
			"SELECT id, flag_status, COALESCE(verdict, ''), COALESCE(is_locked_for_verification, false) FROM submissions WHERE form_id = $1 AND user_id = $2 ORDER BY submitted_at DESC LIMIT 1",
			formID, userID).Scan(&existingID, &existingFlagStatus, &existingVerdict, &isLocked)

		if scanErr == nil && existingID != "" {
			slog.Info("[SubmitForm] Found existing submission", "submission_id", existingID)

			if policyMode == "SINGLE_SHOT" {
				isFlagged := existingFlagStatus != nil && *existingFlagStatus == "flagged"
				if !isFlagged {
					return false, "", false, fmt.Errorf("You have already submitted this form. Updates are not allowed.")
				}
			}

			if isLocked {
				slog.Warn("[SubmitForm] Attempt to update locked submission", "submission_id", existingID)
				return true, existingID, true, nil
			}

			return true, existingID, false, nil
		}
	}
	return false, "", false, nil
}

func updateSubmission(ctx context.Context, pool *pgxpool.Pool, existingID string, responses json.RawMessage, verdict string, verificationStatus string) (string, string, string, error) {
	var subID string
	var finalVerdict string
	var finalStatus string

	sqlUpdate := `
		UPDATE submissions 
		SET responses = $1, 
			verdict = $2, 
			verification_status = $3,
			flag_status = NULL,
			flag_message = NULL,
			flag_fields = NULL,
			updated_at = NOW() 
		WHERE id = $4 AND is_locked_for_verification = FALSE
		RETURNING id, verdict, verification_status
	`
	err := pool.QueryRow(ctx, sqlUpdate, responses, verdict, verificationStatus, existingID).Scan(&subID, &finalVerdict, &finalStatus)

	// If ErrNoRows is returned here, it means the row was locked concurrently between policy check and update
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", fmt.Errorf("this submission was just locked for verification by the system. Please try again shortly")
	}
	return subID, finalVerdict, finalStatus, err
}

func createSubmission(ctx context.Context, pool *pgxpool.Pool, formID string, userID string, responses json.RawMessage, verdict string, verificationStatus string) (string, string, string, error) {
	var subID string
	var finalVerdict string
	var finalStatus string

	sqlInsert := `
		INSERT INTO submissions (form_id, user_id, responses, verdict, verification_status, submitted_at) 
		VALUES ($1, $2, $3, $4, $5, NOW()) 
		RETURNING id, verdict, verification_status
	`
	err := pool.QueryRow(ctx, sqlInsert, formID, userID, responses, verdict, verificationStatus).Scan(&subID, &finalVerdict, &finalStatus)
	return subID, finalVerdict, finalStatus, err
}

// GetSubmissions: Returns list of submissions for a form (For Admin/Response Tab).
func GetSubmissions(c *gin.Context) {
	formID := c.Param("id")

	// 1. Verify Ownership
	realUserID, err := ResolveUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	conn := db.GetPool()
	var ownerID string
	err = conn.QueryRow(c.Request.Context(), "SELECT user_id FROM forms WHERE id = $1", formID).Scan(&ownerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	if ownerID != realUserID.String() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// 2. Fetch Submissions with User Email
	sql := `
		SELECT s.id, s.form_id, s.responses, s.verdict, s.verification_status, s.submitted_at, u.email
		FROM submissions s
		LEFT JOIN users u ON s.user_id = u.id
		WHERE s.form_id = $1 
		ORDER BY s.submitted_at DESC
	`

	rows, err := conn.Query(c.Request.Context(), sql, formID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	// Let's use a struct that includes email
	type SubmissionWithEmail struct {
		domain.Submission
		Email *string // Nullable if left join fails (shouldn't given constraint)
	}

	var results []SubmissionWithEmail

	for rows.Next() {
		var s SubmissionWithEmail
		var responsesBytes []byte

		err := rows.Scan(
			&s.ID, &s.FormID, &responsesBytes, &s.Verdict, &s.VerificationStatus, &s.SubmittedAt, &s.Email,
		)
		if err != nil {
			continue
		}

		if len(responsesBytes) > 0 {
			s.Responses = responsesBytes
		}

		results = append(results, s)
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Transformer for easier frontend consumption:
	var response []map[string]any
	for _, s := range results {
		name := "Unknown"
		var responsesMap map[string]any
		if err := json.Unmarshal(s.Responses, &responsesMap); err == nil {
			if n, ok := responsesMap["f_name"].(string); ok {
				name = n
			}
		}

		email := "Unknown"
		if s.Email != nil {
			email = *s.Email
		}

		// We avoid mapping the internal structure, just send the JSON
		response = append(response, map[string]any{
			"id":           s.ID,
			"form_id":      s.FormID,
			"name":         name,
			"email":        email,
			"submitted_at": s.SubmittedAt,
			"status":       s.VerificationStatus, // verified/pending
			"responses":    s.Responses,
			"verdict":      s.Verdict,
		})
	}

	c.JSON(http.StatusOK, gin.H{"submissions": response})
}

// VerifySubmissions: Batch verification trigger.
func VerifySubmissions(c *gin.Context) {
	formID := c.Param("id")

	var req struct {
		CandidateIDs []string `json:"candidate_ids"`
		Fields       []string `json:"fields"` // Field IDs to verify
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// 1. CRITICAL SECURITY: Verify Ownership
	realUserID, err := ResolveUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	conn := db.GetPool()

	// Check form ownership
	var ownerID string
	err = conn.QueryRow(c.Request.Context(), "SELECT user_id FROM forms WHERE id = $1", formID).Scan(&ownerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	if ownerID != realUserID.String() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied - only form owner can run verification"})
		return
	}

	// 2. Fetch Form Definition (for Rules/Config)
	var form domain.Form
	var fieldsBytes []byte
	err = conn.QueryRow(c.Request.Context(), "SELECT fields FROM forms WHERE id=$1", formID).Scan(&fieldsBytes)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}
	if err := json.Unmarshal(fieldsBytes, &form.Fields); err != nil {
		slog.Warn("[VerifySubmissions] Failed to unmarshal fields", "error", err)
	}

	// 4. Enqueue Asynq Jobs per Platform
	platformFields := make(map[string][]string)
	for _, field := range form.Fields {
		if field.Type == "smart_field" && field.VerificationConfig != nil {
			p := field.VerificationConfig.Platform
			if p != "" {
				platformFields[p] = append(platformFields[p], field.ID)
			}
		}
	}

	if len(platformFields) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Form has no smart fields to verify"})
		return
	}

	jobIDs := []string{}
	for platform, fieldIDs := range platformFields {
		payload := queue.NewVerificationJob(formID, platform, req.CandidateIDs, fieldIDs)
		jobID, err := queue.EnqueueAdminNow(platform, payload)
		if err != nil {
			slog.Error("[VerifySubmissions] Failed to enqueue job", "platform", platform, "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enqueue verification jobs"})
			return
		}
		jobIDs = append(jobIDs, jobID)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Verification enqueued",
		"job_ids": jobIDs,
	})
}

// DeleteSubmissions: Batch delete submissions with ownership check.
func DeleteSubmissions(c *gin.Context) {
	formID := c.Param("id")

	var req struct {
		SubmissionIDs []string `json:"submission_ids"`
	}

	if err := c.ShouldBindJSON(&req); err != nil || len(req.SubmissionIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request or no IDs provided"})
		return
	}

	// Verify ownership of form first
	realUserID, err := ResolveUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User lookup failed"})
		return
	}

	conn := db.GetPool()

	// Check form ownership
	var ownerID string
	err = conn.QueryRow(context.Background(), "SELECT user_id FROM forms WHERE id = $1", formID).Scan(&ownerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	if ownerID != realUserID.String() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Delete submissions that belong to this form
	sql := `DELETE FROM submissions WHERE id = ANY($1) AND form_id = $2`
	result, err := conn.Exec(context.Background(), sql, req.SubmissionIDs, formID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Delete failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Submissions deleted",
		"deleted": result.RowsAffected(),
	})
}

// FlagSubmissions: Bulk flag submissions for correction.
func FlagSubmissions(c *gin.Context) {
	formID := c.Param("id")

	var req struct {
		SubmissionIDs []string `json:"submission_ids"`
		Message       string   `json:"message"`
		Fields        []string `json:"fields"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if len(req.SubmissionIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No submission IDs provided"})
		return
	}

	conn := db.GetPool()

	// Verify ownership
	realUserID, err := ResolveUserID(c)
	if err != nil || realUserID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var ownerID string
	var configBytes []byte
	err = conn.QueryRow(context.Background(), "SELECT user_id, config FROM forms WHERE id = $1", formID).Scan(&ownerID, &configBytes)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	if ownerID != realUserID.String() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// [NEW] Check Lock After Verification Policy
	var formConfig domain.FormConfig
	if len(configBytes) > 0 {
		if unmarshalErr := json.Unmarshal(configBytes, &formConfig); unmarshalErr != nil {
			slog.Warn("[FlagSubmissions] Failed to unmarshal config", "error", unmarshalErr)
		}
	}

	policyMode := formConfig.SubmissionPolicy.Mode
	if policyMode == "" {
		policyMode = "SINGLE_EDITABLE"
	}

	// [NEW] For SINGLE_* policies, only allow flagging the LATEST submission per user
	if policyMode == "SINGLE_EDITABLE" || policyMode == "SINGLE_SHOT" {
		if validateErr := validateSubmissionsAreLatest(context.Background(), conn, formID, req.SubmissionIDs); validateErr != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": validateErr.Error()})
			return
		}
	}

	// Update flag status for selected submissions
	sql := `UPDATE submissions 
			SET flag_status = 'flagged', 
				flag_message = $1, 
				flag_fields = $2::text[],
				updated_at = NOW()
			WHERE id = ANY($3) AND form_id = $4`
	result, err := conn.Exec(context.Background(), sql, req.Message, req.Fields, req.SubmissionIDs, formID)
	if err != nil {
		slog.Error("FlagSubmissions error", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Flag update failed", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Submissions flagged for correction",
		"flagged": result.RowsAffected(),
	})
}

type SubmissionInfo struct {
	ID                 string          `json:"id"`
	Data               json.RawMessage `json:"data"`
	Verdict            string          `json:"verdict,omitempty"`
	VerificationStatus string          `json:"verification_status,omitempty"`
	FlagStatus         *string         `json:"flag_status"`
	FlagMessage        *string         `json:"flag_message"`
	FlagFields         []string        `json:"flag_fields"`
	SubmittedAt        time.Time       `json:"submitted_at"`
}

func GetMySubmission(c *gin.Context) {
	formID := c.Param("id")

	userID, err := ResolveUserID(c)
	if err != nil || userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	conn := db.GetPool()

	var configBytes []byte
	var ownerID string
	var formStatus string
	err = conn.QueryRow(context.Background(), "SELECT config, user_id, status FROM forms WHERE id = $1", formID).Scan(&configBytes, &ownerID, &formStatus)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	var formConfig domain.FormConfig
	if len(configBytes) > 0 {
		if unmarshalErr := json.Unmarshal(configBytes, &formConfig); unmarshalErr != nil {
			slog.Warn("[GetMySubmission] Failed to unmarshal config", "error", unmarshalErr)
		}
	}

	policyMode := formConfig.SubmissionPolicy.Mode
	if policyMode == "" {
		policyMode = "SINGLE_EDITABLE"
	}

	userEmail, err := getUserEmail(c.Request.Context(), userID)
	if err != nil {
		slog.Error("[GetMySubmission] Failed to get user email", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify access"})
		return
	}

	allowed, blockMessage := CheckAccessControl(formConfig.AccessControl, userEmail, false)
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": blockMessage})
		return
	}

	submissions, flaggedSubmissions, err := fetchUserSubmissions(c.Request.Context(), conn, formID, userID, policyMode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submissions"})
		return
	}

	response := formatSubmissionsResponse(policyMode, formConfig, submissions, flaggedSubmissions)
	response["form_status"] = formStatus
	c.JSON(http.StatusOK, response)
}

func fetchUserSubmissions(ctx context.Context, conn *pgxpool.Pool, formID string, userID *uuid.UUID, policyMode string) ([]SubmissionInfo, []SubmissionInfo, error) {
	var submissions []SubmissionInfo
	var flaggedSubmissions []SubmissionInfo

	if policyMode == "UNLIMITED" {
		rows, queryErr := conn.Query(ctx,
			`SELECT id, responses, COALESCE(verdict, ''), 
			        COALESCE(verification_status, 'pending'), flag_status, flag_message, flag_fields, submitted_at 
			 FROM submissions 
			 WHERE form_id = $1 AND user_id = $2
			 ORDER BY submitted_at DESC`,
			formID, userID)
		if queryErr != nil {
			return nil, nil, queryErr
		}
		defer rows.Close()

		for rows.Next() {
			var sub SubmissionInfo
			if scanErr := rows.Scan(&sub.ID, &sub.Data, &sub.Verdict,
				&sub.VerificationStatus, &sub.FlagStatus, &sub.FlagMessage, &sub.FlagFields, &sub.SubmittedAt); scanErr != nil {
				continue
			}
			submissions = append(submissions, sub)
			if sub.FlagStatus != nil && *sub.FlagStatus == "flagged" {
				flaggedSubmissions = append(flaggedSubmissions, sub)
			}
		}
	} else {
		var sub SubmissionInfo
		scanErr := conn.QueryRow(ctx,
			`SELECT id, responses, COALESCE(verdict, ''), 
			        COALESCE(verification_status, 'pending'), flag_status, flag_message, flag_fields, submitted_at 
			 FROM submissions 
			 WHERE form_id = $1 AND user_id = $2
			 ORDER BY submitted_at DESC
			 LIMIT 1`,
			formID, userID).Scan(&sub.ID, &sub.Data, &sub.Verdict,
			&sub.VerificationStatus, &sub.FlagStatus, &sub.FlagMessage, &sub.FlagFields, &sub.SubmittedAt)

		if scanErr == nil {
			submissions = append(submissions, sub)
			if sub.FlagStatus != nil && *sub.FlagStatus == "flagged" {
				flaggedSubmissions = append(flaggedSubmissions, sub)
			}
		}
	}
	return submissions, flaggedSubmissions, nil
}

func validateSubmissionsAreLatest(ctx context.Context, conn *pgxpool.Pool, formID string, subIDs []string) error {
	for _, subID := range subIDs {
		var isLatest bool
		checkErr := conn.QueryRow(ctx,
			`SELECT s.id = (
				SELECT id FROM submissions 
				WHERE form_id = $1 AND user_id = s.user_id 
				ORDER BY submitted_at DESC LIMIT 1
			) FROM submissions s WHERE s.id = $2`,
			formID, subID).Scan(&isLatest)

		if checkErr == nil && !isLatest {
			return fmt.Errorf("Cannot request correction on older submissions. Policy allows editing only the latest submission per user.")
		}
	}
	return nil
}

func formatSubmissionsResponse(policyMode string, formConfig domain.FormConfig, submissions []SubmissionInfo, flaggedSubmissions []SubmissionInfo) gin.H {
	if !formConfig.PostSubmitBehavior.ShowVerdict {
		for i := range submissions {
			submissions[i].Verdict = ""
			submissions[i].VerificationStatus = ""
		}
		for i := range flaggedSubmissions {
			flaggedSubmissions[i].Verdict = ""
			flaggedSubmissions[i].VerificationStatus = ""
		}
	}

	canSubmitNew := policyMode == "UNLIMITED" || len(submissions) == 0
	canEditLatest := false
	if len(submissions) > 0 {
		latest := submissions[0]
		isFlagged := latest.FlagStatus != nil && *latest.FlagStatus == "flagged"
		canEditLatest = (policyMode == "SINGLE_EDITABLE" || isFlagged)
	}

	response := gin.H{
		"policy":               policyMode,
		"flagged":              flaggedSubmissions,
		"can_submit_new":       canSubmitNew,
		"can_edit_latest":      canEditLatest,
		"form_title":           formConfig.Meta.Title,
		"post_submit_behavior": formConfig.PostSubmitBehavior,
	}

	if policyMode == "UNLIMITED" {
		response["submissions"] = submissions
	} else {
		var submission interface{} = nil
		if len(submissions) > 0 {
			submission = submissions[0]
		}
		response["submission"] = submission
	}
	return response
}
