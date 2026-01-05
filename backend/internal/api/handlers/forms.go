package handlers

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/boobachad/smart_form/backend/internal/db"
	"github.com/boobachad/smart_form/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CreateFormRequest represents input for creating a new form.
type CreateFormRequest struct {
	Title  string             `json:"title" binding:"required"`
	Config domain.FormConfig  `json:"config"`
	Fields []domain.FormField `json:"fields"`
}

func CreateForm(c *gin.Context) {
	// Request Binding
	var req CreateFormRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Serialize JSONB columns
	fieldsJSON, err := json.Marshal(req.Fields)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize fields"})
		return
	}
	if req.Fields == nil {
		fieldsJSON = []byte("[]")
	}
	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize config"})
		return
	}
	if req.Config.Meta.Title == "" {
		configJSON = []byte("{}")
	}

	conn := db.GetPool()
	sql := `INSERT INTO forms (user_id, title, fields, config, status) VALUES ($1, $2, $3, $4, 'draft') RETURNING id, status, verification_status, created_at, updated_at`

	var form domain.Form
	form.Title = req.Title
	if req.Fields != nil {
		form.Fields = req.Fields
	} else {
		form.Fields = []domain.FormField{}
	}
	form.Config = req.Config

	realUserID, err := ResolveUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User lookup failed: " + err.Error()})
		return
	}
	form.UserID = *realUserID

	// QueryRow for RETURNING
	// Default status to 'draft'
	err = conn.QueryRow(c.Request.Context(), sql, realUserID, req.Title, fieldsJSON, configJSON).Scan(
		&form.ID, &form.Status, &form.VerificationStatus, &form.CreatedAt, &form.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create form: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"form": form})
}

func ListForms(c *gin.Context) {
	realUserID, err := ResolveUserID(c)
	if err != nil {
		slog.Error("ListForms: ResolveUserID failed", "error", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User lookup failed: " + err.Error()})
		return
	}
	slog.Info("ListForms: User resolved", "userID", realUserID)

	conn := db.GetPool()
	sql := `
		SELECT 
			f.id, f.title, f.status, f.verification_status, f.created_at, f.updated_at,
			COUNT(s.id) as responses_count,
			COALESCE(SUM(CASE WHEN s.verification_status = 'verified' THEN 1 ELSE 0 END) * 100 / NULLIF(COUNT(s.id), 0), 0) as verified_pct,
			COALESCE(SUM(CASE WHEN s.flag_status = 'flagged' THEN 1 ELSE 0 END), 0) as flagged_count
		FROM forms f
		LEFT JOIN submissions s ON f.id = s.form_id
		WHERE f.user_id = $1
		GROUP BY f.id
		ORDER BY f.created_at DESC
	`

	rows, err := conn.Query(c.Request.Context(), sql, realUserID)
	if err != nil {
		slog.Error("ListForms: Query error", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}
	defer rows.Close()

	forms := []gin.H{} // Lightweight struct for list
	for rows.Next() {
		var f domain.Form
		var responsesCount, verifiedPct, flaggedCount int

		if err := rows.Scan(
			&f.ID, &f.Title, &f.Status, &f.VerificationStatus, &f.CreatedAt, &f.UpdatedAt,
			&responsesCount, &verifiedPct, &flaggedCount,
		); err != nil {
			slog.Error("ListForms: Rows scan error", "error", err)
			continue
		}
		forms = append(forms, gin.H{
			"id":                  f.ID,
			"title":               f.Title,
			"status":              f.Status,
			"verification_status": f.VerificationStatus,
			"created_at":          f.CreatedAt,
			"updated_at":          f.UpdatedAt,
			"responses":           responsesCount,
			"verified_pct":        verifiedPct,
			"flagged":             flaggedCount,
		})
	}

	if err := rows.Err(); err != nil {
		slog.Error("ListForms: Rows iteration error", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error during iteration: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"forms": forms})
}

func GetForm(c *gin.Context) {
	id := c.Param("id")

	// Prevent caching to ensure access control is always fresh
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")

	conn := db.GetPool()

	sql := `SELECT id, user_id, title, status, verification_status, fields, config, created_at, updated_at FROM forms WHERE id = $1`

	var form domain.Form
	var fieldsBytes []byte
	var configBytes []byte

	err := conn.QueryRow(c.Request.Context(), sql, id).Scan(
		&form.ID, &form.UserID, &form.Title, &form.Status, &form.VerificationStatus,
		&fieldsBytes, &configBytes, &form.CreatedAt, &form.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	isOwner := false
	// Check strict auth via ResolveUserID (if middleware ran)
	requestingUserIDPointer, resolveErr := ResolveUserID(c)
	var requestingUserID uuid.UUID
	if resolveErr == nil && requestingUserIDPointer != nil {
		requestingUserID = *requestingUserIDPointer
	}

	// If ResolveUserID successfully returned a user ID, check if it matches the form's owner.
	// If ResolveUserID failed (e.g., no firebase_uid in context, or user not found/created),
	// requestingUserID will be uuid.Nil or the error will be non-nil, and isOwner will remain false.
	isOwner = requestingUserID != uuid.Nil && requestingUserID == form.UserID

	// Strict enforcement: If form is not active, NOBODY can access via public endpoint (including owner).
	// Owners must use the Preview mode.
	if form.Status != "active" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Form is not currently active"})
		return
	}

	// Unmarshal JSONB
	if len(fieldsBytes) > 0 {
		if unmarshalErr := json.Unmarshal(fieldsBytes, &form.Fields); unmarshalErr != nil {
			slog.Warn("[GetForm] Warning: failed to unmarshal fields", "error", unmarshalErr)
			form.Fields = []domain.FormField{}
		}
	} else {
		form.Fields = []domain.FormField{}
	}
	if len(configBytes) > 0 {
		if unmarshalErr := json.Unmarshal(configBytes, &form.Config); unmarshalErr != nil {
			slog.Warn("[GetForm] Warning: failed to unmarshal config", "error", unmarshalErr)
		}
	} else {
		form.Config = domain.FormConfig{
			Meta: domain.FormMeta{Title: form.Title},
		}
	}

	// For published forms: Everyone (including owner) is subject to access control
	// For draft forms: Only owner can access
	isPublished := form.Status == "active"

	// Access control strict enforcement on ALL published forms
	if isPublished {
		var userEmail string
		if requestingUserIDPointer != nil {
			var err error
			userEmail, err = getUserEmail(c.Request.Context(), requestingUserIDPointer)
			if err != nil {
				slog.Error("[GetForm] Failed to get user email", "error", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify access"})
				return
			}
		}

		slog.Info("[GetForm] Access control check", "email", userEmail, "mode", form.Config.AccessControl.Mode, "formStatus", form.Status)
		allowed, blockMessage := CheckAccessControl(form.Config.AccessControl, userEmail, false)
		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"error": blockMessage})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"form": form,
		"meta": gin.H{
			"is_owner": isOwner,
		},
	})
}

// GetFormManage returns the form config for the EDITOR/ADMIN.
// Enforces STRICT OWNERSHIP. Skips Respondent Access Control.
func GetFormManage(c *gin.Context) {
	id := c.Param("id")

	requestingUserIDPointer, resolveErr := ResolveUserID(c)
	if resolveErr != nil || requestingUserIDPointer == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	requestingUserID := *requestingUserIDPointer

	// Query form and Check Ownership
	conn := db.GetPool()
	var form domain.Form
	var fieldsBytes, configBytes []byte

	sqlQuery := `
		SELECT id, user_id, title, fields, config, status, created_at, updated_at
		FROM forms 
		WHERE id = $1`

	err := conn.QueryRow(c.Request.Context(), sqlQuery, id).Scan(
		&form.ID, &form.UserID, &form.Title, &fieldsBytes, &configBytes, &form.Status, &form.CreatedAt, &form.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Verify Owner
	if form.UserID != requestingUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the owner can manage this form"})
		return
	}

	// Unmarshal JSONB
	if len(fieldsBytes) > 0 {
		if unmarshalErr := json.Unmarshal(fieldsBytes, &form.Fields); unmarshalErr != nil {
			slog.Warn("[GetFormManage] Warning: failed to unmarshal fields", "error", unmarshalErr)
			form.Fields = []domain.FormField{}
		}
	} else {
		form.Fields = []domain.FormField{}
	}
	if len(configBytes) > 0 {
		if unmarshalErr := json.Unmarshal(configBytes, &form.Config); unmarshalErr != nil {
			slog.Warn("[GetFormManage] Warning: failed to unmarshal config", "error", unmarshalErr)
		}
	} else {
		form.Config = domain.FormConfig{
			Meta: domain.FormMeta{Title: form.Title},
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"form": form,
		"meta": gin.H{
			"is_owner": true,
			"mode":     "manage",
		},
	})
}

// UpdateFormStatusRequest defines input for status patches.
type UpdateFormStatusRequest struct {
	Status string `json:"status" binding:"required"` // active, draft
}

func UpdateFormStatus(c *gin.Context) {
	id := c.Param("id")
	realUserID, err := ResolveUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User lookup failed"})
		return
	}

	var req UpdateFormStatusRequest
	if bindErr := c.ShouldBindJSON(&req); bindErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": bindErr.Error()})
		return
	}

	// Validate status
	if req.Status != "active" && req.Status != "draft" && req.Status != "closed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Use active, draft, or closed."})
		return
	}

	conn := db.GetPool()

	// If attempting to publish, ensure the form has at least one field
	if req.Status == "active" {
		var fieldsJSON []byte
		checkSQL := `SELECT fields FROM forms WHERE id = $1 AND user_id = $2`
		err = conn.QueryRow(c.Request.Context(), checkSQL, id, realUserID).Scan(&fieldsJSON)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Form not found or access denied"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check form readiness"})
			return
		}

		var fields []interface{}
		err = json.Unmarshal(fieldsJSON, &fields)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse form fields"})
			return
		}

		if len(fields) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot publish an empty form. Please add at least one field."})
			return
		}
	}

	sql := `UPDATE forms SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING status`

	var newStatus string
	err = conn.QueryRow(c.Request.Context(), sql, req.Status, id, realUserID).Scan(&newStatus)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Form not found or access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Status updated",
		"status":  newStatus,
	})
}

func UpdateForm(c *gin.Context) {
	id := c.Param("id")
	realUserID, err := ResolveUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User lookup failed"})
		return
	}

	var req CreateFormRequest // Reuse
	if bindErr := c.ShouldBindJSON(&req); bindErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": bindErr.Error()})
		return
	}

	fieldsJSON, marshalErr := json.Marshal(req.Fields)
	if marshalErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize fields"})
		return
	}
	configJSON, marshalErr := json.Marshal(req.Config)
	if marshalErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize config"})
		return
	}

	conn := db.GetPool()
	// Update with Ownership check
	sql := `UPDATE forms SET title = $1, fields = $2, config = $3, updated_at = NOW() WHERE id = $4 AND user_id = $5 RETURNING updated_at`

	var updatedAt time.Time
	err = conn.QueryRow(c.Request.Context(), sql, req.Title, fieldsJSON, configJSON, id, realUserID).Scan(&updatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Form not found or access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Form updated",
		"updated_at": updatedAt,
	})
}

func DeleteForm(c *gin.Context) {
	id := c.Param("id")
	realUserID, err := ResolveUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User lookup failed"})
		return
	}

	conn := db.GetPool()
	// Delete with ownership check - CASCADE will handle submissions
	sql := `DELETE FROM forms WHERE id = $1 AND user_id = $2`

	result, err := conn.Exec(c.Request.Context(), sql, id, realUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Delete failed"})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found or access denied"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Form deleted successfully",
	})
}
