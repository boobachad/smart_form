package handlers

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/boobachad/smart_form/backend/internal/db"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Consolidates logic previously in forms.go.
func ResolveUserID(c *gin.Context) (*uuid.UUID, error) {
	// If context has firebase_uid, assume we need to lookup
	firebaseUID, ok := c.Get("firebase_uid")
	if !ok {
		return nil, pgx.ErrNoRows
	}

	conn := db.GetPool()
	var id uuid.UUID

	sqlSelect := `SELECT id FROM users WHERE firebase_uid = $1`
	err := conn.QueryRow(c.Request.Context(), sqlSelect, firebaseUID).Scan(&id)

	if errors.Is(err, pgx.ErrNoRows) {
		// Auto-create user on first auth (Firebase-authenticated users)
		// Get email from context if available
		email := ""
		name := ""
		if e, ok := c.Get("email"); ok {
			if eStr, ok := e.(string); ok {
				email = eStr
			}
		}
		if n, ok := c.Get("name"); ok {
			if nStr, ok := n.(string); ok {
				name = nStr
			}
		}

		// Non-standard case: Missing email in token.
		if email == "" {
			slog.Warn("ResolveUserID: Token verified but email missing for uid. Rejecting creation.", "firebaseUID", firebaseUID)
			return nil, fmt.Errorf("email required for user creation")
		}

		// Insert user (using simple schema with explicit STANDARD role)
		sqlInsert := `INSERT INTO users (email, name, firebase_uid, role) VALUES ($1, $2, $3, 'STANDARD') ON CONFLICT (firebase_uid) DO UPDATE SET name = EXCLUDED.name RETURNING id`
		err = conn.QueryRow(c.Request.Context(), sqlInsert, email, name, firebaseUID).Scan(&id)
		if err != nil {
			slog.Error("ResolveUserID: Auto-create failed", "firebaseUID", firebaseUID, "error", err)
			return nil, fmt.Errorf("failed to auto-create user")
		}
		slog.Info("User auto-created [Role: STANDARD]", "email", email, "firebaseUID", firebaseUID)
		return &id, nil
	} else if err != nil {
		return nil, err
	}

	return &id, nil
}

// Consolidates logic previously in ratelimit.go.
func GetFormOwnerID(ctx context.Context, formID string) (string, error) {
	conn := db.GetPool()
	var ownerID string
	err := conn.QueryRow(ctx, "SELECT user_id FROM forms WHERE id=$1", formID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return ownerID, nil
}
