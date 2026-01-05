package handlers

import (
	"context"
	"errors"
	"log/slog"

	"github.com/boobachad/smart_form/backend/internal/db"
	"github.com/google/uuid"
)

// CheckAndIncrementFetchAttempt increments the counter and returns the new count.
// Returns error if DB fails.
func CheckAndIncrementFetchAttempt(ctx context.Context, formID string, fieldID string, userID *uuid.UUID, sessionID string, idempotencyKey string) (int, error) {
	conn := db.GetPool()

	var finalUserID interface{} = nil
	var finalSessionID interface{} = nil

	if userID != nil {
		finalUserID = *userID
	} else if sessionID != "" {
		finalSessionID = sessionID
	} else {
		return 0, errors.New("neither user_id nor session_id provided")
	}

	var parsedKey interface{} = nil
	if idempotencyKey != "" {
		parsed, err := uuid.Parse(idempotencyKey)
		if err == nil {
			parsedKey = parsed
		}
	}

	sqlInsert := `
		INSERT INTO fetch_attempts (form_id, field_id, user_id, session_id, idempotency_key, attempt_count, last_attempt_at)
		VALUES ($1, $2, $3, $4, $5, 1, NOW())
		ON CONFLICT (idempotency_key) DO UPDATE SET attempt_count = fetch_attempts.attempt_count + 1, last_attempt_at = NOW()
		RETURNING attempt_count`

	var newCount int
	err := conn.QueryRow(ctx, sqlInsert, formID, fieldID, finalUserID, finalSessionID, parsedKey).Scan(&newCount)
	if err != nil {
		slog.Error("RateLimit: DB Error on insert", "error", err)
		return 0, err
	}

	return newCount, nil
}

// Called after successful form submission to give user fresh attempts.
func ResetFetchAttempts(ctx context.Context, formID string, userID *uuid.UUID, sessionID string) error {
	conn := db.GetPool()

	// Determine which key to reset
	var err error

	if userID != nil {
		sqlReset := `DELETE FROM fetch_attempts WHERE form_id = $1 AND user_id = $2`
		_, err = conn.Exec(ctx, sqlReset, formID, *userID)
		slog.Info("[RATE_LIMIT] Resetting fetch attempts", "form", formID, "user", userID)
	} else if sessionID != "" {
		sqlReset := `DELETE FROM fetch_attempts WHERE form_id = $1 AND session_id = $2`
		_, err = conn.Exec(ctx, sqlReset, formID, sessionID)
		slog.Info("[RATE_LIMIT] Resetting fetch attempts", "form", formID, "session", sessionID)
	} else {
		return errors.New("neither user_id nor session_id provided")
	}

	if err != nil {
		slog.Error("[RATE_LIMIT] Failed to reset fetch attempts", "error", err)
		return err
	}

	slog.Info("[RATE_LIMIT] Successfully reset fetch attempts", "form", formID)
	return nil
}
