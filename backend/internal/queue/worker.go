package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/boobachad/smart_form/backend/internal/db"
	"github.com/boobachad/smart_form/backend/internal/domain"
	"github.com/boobachad/smart_form/backend/internal/verification"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// NewLeetCodeWorker creates an Asynq server for LeetCode queue.
func NewLeetCodeWorker(redisClient *redis.Client) *asynq.Server {
	redisOpt := asynq.RedisClientOpt{
		Addr: redisClient.Options().Addr,
		DB:   redisClient.Options().DB,
	}

	if redisClient.Options().Password != "" {
		redisOpt.Password = redisClient.Options().Password
	}

	return asynq.NewServer(
		redisOpt,
		asynq.Config{
			Queues: map[string]int{
				"leetcode:interactive": 3,
				"leetcode:admin_now":   2,
				"leetcode:batch":       1,
			},
			StrictPriority: true, // Process interactive EXCLUSIVELY until empty
			Concurrency:    5,    // Max 5 parallel LeetCode API calls
		},
	)
}

// NewCodeforcesWorker creates an Asynq server for Codeforces queue.
func NewCodeforcesWorker(redisClient *redis.Client) *asynq.Server {
	redisOpt := asynq.RedisClientOpt{
		Addr: redisClient.Options().Addr,
		DB:   redisClient.Options().DB,
	}

	if redisClient.Options().Password != "" {
		redisOpt.Password = redisClient.Options().Password
	}

	return asynq.NewServer(
		redisOpt,
		asynq.Config{
			Queues: map[string]int{
				"codeforces:interactive": 3,
				"codeforces:admin_now":   2,
				"codeforces:batch":       1,
			},
			StrictPriority: true,
			Concurrency:    3, // Lower concurrency for Codeforces rate limits
		},
	)
}

// NewGitHubWorker creates an Asynq server for GitHub queue.
func NewGitHubWorker(redisClient *redis.Client) *asynq.Server {
	redisOpt := asynq.RedisClientOpt{
		Addr: redisClient.Options().Addr,
		DB:   redisClient.Options().DB,
	}

	if redisClient.Options().Password != "" {
		redisOpt.Password = redisClient.Options().Password
	}

	return asynq.NewServer(
		redisOpt,
		asynq.Config{
			Queues: map[string]int{
				"github:interactive": 3,
				"github:admin_now":   2,
				"github:batch":       1,
			},
			StrictPriority: true,
			Concurrency:    5,
		},
	)
}

func ProcessVerificationJob(ctx context.Context, task *asynq.Task) error {
	var payload VerificationJobPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	slog.Info(fmt.Sprintf("[Worker:%s] Processing job %s", payload.Platform, payload.JobID))
	pool := db.GetPool()

	if _, err := pool.Exec(ctx, `UPDATE verification_jobs SET status = 'PROCESSING', started_at = NOW() WHERE id = $1`, payload.JobID); err != nil {
		slog.Info(fmt.Sprintf("[Worker] Failed to update job status: %v", err))
		return fmt.Errorf("failed to update job status: %w", err)
	}

	engine := verification.NewEngine()
	successCount, failureCount := 0, 0
	var lastError error

	if len(payload.Scope.SubmissionIDs) == 0 {
		err := processSimulationMode(ctx, pool, payload, engine)
		if err != nil {
			failureCount++
			lastError = err
		} else {
			successCount++
		}
	} else {
		successCount, failureCount, lastError = processStandardMode(ctx, pool, payload, engine)
	}

	finalStatus := "COMPLETED"
	errorMessage := ""
	if failureCount > 0 {
		finalStatus = "FAILED"
		if lastError != nil {
			errorMessage = lastError.Error()
		}
	}

	if _, err := pool.Exec(ctx, `UPDATE verification_jobs SET status = $1, completed_at = NOW(), error_message = $2 WHERE id = $3`, finalStatus, errorMessage, payload.JobID); err != nil {
		slog.Error("[Worker] Failed to finalize job status", "error", err)
	}

	slog.Info("[Worker] Job completed", "platform", payload.Platform, "job_id", payload.JobID, "successes", successCount, "failures", failureCount)

	if finalStatus == "FAILED" {
		return fmt.Errorf("job failed: %d/%d submissions failed", failureCount, len(payload.Scope.SubmissionIDs))
	}
	return nil
}

func processSimulationMode(ctx context.Context, pool *pgxpool.Pool, payload VerificationJobPayload, engine *verification.VerificationEngine) error {
	slog.Info(fmt.Sprintf("[Worker:%s] Simulation mode - verifying handle: %s", payload.Platform, payload.Handle))
	if payload.Handle == "" {
		return fmt.Errorf("simulation mode requires handle")
	}

	platform := payload.SimulationPlatform
	if platform == "" {
		platform = payload.Platform
	}

	result, verifyErr := engine.VerifySingle(ctx, platform, payload.Handle, payload.SimulationTargets)
	if verifyErr != nil {
		_, updateErr := pool.Exec(ctx, `UPDATE verification_jobs SET status = 'FAILED', completed_at = NOW(), error_message = $2 WHERE id = $1`, payload.JobID, verifyErr.Error())
		if updateErr != nil {
			slog.Error("[Worker] Failed to update failed simulation job", "error", updateErr)
		}
		return fmt.Errorf("simulation verification failed: %w", verifyErr)
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		slog.Error("[Worker] Failed to marshal simulation result", "error", err)
		return fmt.Errorf("failed to marshal result: %w", err)
	}

	if _, err = pool.Exec(ctx, `UPDATE verification_jobs SET status = 'COMPLETED', completed_at = NOW(), result = $2 WHERE id = $1`, payload.JobID, resultJSON); err != nil {
		slog.Error("[Worker] Failed to update simulation job", "error", err)
		return fmt.Errorf("failed to complete simulation: %w", err)
	}
	return nil
}

func processStandardMode(ctx context.Context, pool *pgxpool.Pool, payload VerificationJobPayload, engine *verification.VerificationEngine) (int, int, error) {
	successCount, failureCount := 0, 0
	var lastError error

	for _, submissionID := range payload.Scope.SubmissionIDs {
		err := lockSubmission(ctx, pool, submissionID)
		if err != nil {
			slog.Error("[Worker] Failed to process submission", "error", err)
			failureCount++
			lastError = err
			continue
		}

		err = verifyAndSaveSubmission(ctx, pool, payload, engine, submissionID)
		if err != nil {
			slog.Error("[Worker] Failed to process submission", "error", err)
			failureCount++
			lastError = err
			continue
		}
		successCount++
	}
	return successCount, failureCount, lastError
}

func lockSubmission(ctx context.Context, pool *pgxpool.Pool, submissionID string) error {
	tx, txErr := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
	if txErr != nil {
		return txErr
	}

	defer func() {
		if rErr := tx.Rollback(ctx); rErr != nil && !errors.Is(rErr, pgx.ErrTxClosed) {
			slog.Error("[Worker] Tx rollback error", "error", rErr)
		}
	}()

	var locked bool
	if queryErr := tx.QueryRow(ctx, `
		SELECT is_locked_for_verification 
		FROM submissions 
		WHERE id = $1 AND is_locked_for_verification = FALSE 
		FOR UPDATE SKIP LOCKED`, submissionID).Scan(&locked); queryErr != nil {

		if errors.Is(queryErr, pgx.ErrNoRows) {
			return fmt.Errorf("submission is already locked or does not exist")
		}
		return fmt.Errorf("failed to query submission: %w", queryErr)
	}

	if _, execErr := tx.Exec(ctx, `UPDATE submissions SET is_locked_for_verification = TRUE WHERE id = $1`, submissionID); execErr != nil {
		return fmt.Errorf("failed to lock submission: %w", execErr)
	}

	return tx.Commit(ctx)
}

func extractSmartFieldState(fields []domain.FormField, rawState map[string]json.RawMessage) map[string]domain.UnifiedFieldState {
	state := make(map[string]domain.UnifiedFieldState)
	for _, field := range fields {
		if field.Type == "smart_field" {
			if rawMsg, ok := rawState[field.ID]; ok {
				var u domain.UnifiedFieldState
				if unmarshalStateErr := json.Unmarshal(rawMsg, &u); unmarshalStateErr == nil {
					state[field.ID] = u
				}
			}
		}
	}
	return state
}

func filterFieldsForSelective(fields []domain.FormField, payload VerificationJobPayload) []domain.FormField {
	if payload.Targets.Type != "SELECTIVE" || len(payload.Targets.FieldIDs) == 0 {
		return fields
	}
	var filtered []domain.FormField
	for _, field := range fields {
		for _, targetID := range payload.Targets.FieldIDs {
			if field.ID == targetID {
				filtered = append(filtered, field)
				break
			}
		}
	}
	return filtered
}

func verifyAndSaveSubmission(ctx context.Context, pool *pgxpool.Pool, payload VerificationJobPayload, engine *verification.VerificationEngine, submissionID string) error {
	var responsesBytes, fieldsBytes []byte
	var formID string
	err := pool.QueryRow(ctx, `SELECT s.responses, s.form_id, f.fields FROM submissions s JOIN forms f ON f.id = s.form_id WHERE s.id = $1`, submissionID).Scan(&responsesBytes, &formID, &fieldsBytes)
	if err != nil {
		return err
	}

	var fields []domain.FormField
	var rawState map[string]json.RawMessage
	if unmarshalErr := json.Unmarshal(fieldsBytes, &fields); unmarshalErr != nil {
		unlockSubmission(ctx, pool, submissionID)
		return unmarshalErr
	}
	if unmarshalErr := json.Unmarshal(responsesBytes, &rawState); unmarshalErr != nil {
		unlockSubmission(ctx, pool, submissionID)
		return unmarshalErr
	}

	state := extractSmartFieldState(fields, rawState)
	fields = filterFieldsForSelective(fields, payload)

	updatedState, verifyErr := engine.VerifySubmission(ctx, fields, state)
	if verifyErr != nil {
		unlockSubmission(ctx, pool, submissionID)
		return verifyErr
	}

	// Merge back updated states
	for id, u := range updatedState {
		b, mErr := json.Marshal(u)
		if mErr == nil {
			rawState[id] = b
		}
	}

	verdict := engine.EvaluateVerdict(fields, updatedState)
	resultBytes, marshalErr := json.Marshal(rawState)
	if marshalErr != nil {
		slog.Error("[Worker] Marshal error", "error", marshalErr)
	}

	_, err = pool.Exec(ctx, `UPDATE submissions SET responses = $1, verdict = $2, verification_status = 'verified', is_locked_for_verification = FALSE, updated_at = NOW() WHERE id = $3`, resultBytes, verdict, submissionID)
	return err
}

func unlockSubmission(ctx context.Context, pool *pgxpool.Pool, submissionID string) {
	if _, err := pool.Exec(ctx, `UPDATE submissions SET is_locked_for_verification = FALSE WHERE id = $1`, submissionID); err != nil {
		slog.Error("[Worker] Failed to unlock", "error", err)
	}
}

// RegisterHandlers registers task handlers with the worker mux.
func RegisterHandlers(mux *asynq.ServeMux) {
	mux.HandleFunc("verification:process", ProcessVerificationJob)
}
