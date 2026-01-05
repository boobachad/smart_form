package queue

import (
	"context"
	"log/slog"
	"time"

	"github.com/boobachad/smart_form/backend/internal/db"
)

// This handles the case where a worker crashes mid-processing.
func RecoverOrphanedLocks() {
	ctx := context.Background()
	pool := db.GetPool()

	// Find jobs stuck in PROCESSING for >10 minutes
	rows, err := pool.Query(ctx, `
		SELECT id, scope_submission_ids 
		FROM verification_jobs 
		WHERE status = 'PROCESSING' 
		AND started_at < NOW() - INTERVAL '10 minutes'
	`)
	if err != nil {
		slog.Error("[Recovery] Failed to query orphaned jobs", "error", err)
		return
	}
	defer rows.Close()

	recoveredCount := 0

	for rows.Next() {
		var jobID string
		var submissionIDs []string

		if err := rows.Scan(&jobID, &submissionIDs); err != nil {
			slog.Error("[Recovery] Failed to scan job", "error", err)
			continue
		}

		// Unlock all submissions for this job
		result, err := pool.Exec(ctx, `
			UPDATE submissions 
			SET is_locked_for_verification = FALSE 
			WHERE id = ANY($1)
		`, submissionIDs)

		if err != nil {
			slog.Error("[Recovery] Failed to unlock submissions for job", "jobID", jobID, "error", err)
			continue
		}

		// Mark job as failed
		_, err = pool.Exec(ctx, `
			UPDATE verification_jobs 
			SET status = 'FAILED', 
			    completed_at = NOW(),
			    error_message = 'Server crash - job abandoned' 
			WHERE id = $1
		`, jobID)

		if err != nil {
			slog.Error("[Recovery] Failed to mark job as failed", "jobID", jobID, "error", err)
			continue
		}

		rowsAffected := result.RowsAffected()
		slog.Info("[Recovery] Recovered job", "jobID", jobID, "unlockedSubmissions", rowsAffected)
		recoveredCount++
	}

	if recoveredCount > 0 {
		slog.Info("[Recovery] Completed", "recoveredJobs", recoveredCount)
	}
}

// ScheduleOrphanedLockCleanup runs orphaned lock recovery every 5 minutes.
func ScheduleOrphanedLockCleanup(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			RecoverOrphanedLocks()
		}
	}
}
