package queue

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
)

var (
	asynqClient *asynq.Client
)

// InitClient initializes the Asynq client.
func InitClient(redisClient *redis.Client) error {
	redisOpt := asynq.RedisClientOpt{
		Addr: redisClient.Options().Addr,
		DB:   redisClient.Options().DB,
	}

	if redisClient.Options().Password != "" {
		redisOpt.Password = redisClient.Options().Password
	}

	asynqClient = asynq.NewClient(redisOpt)
	return nil
}

// Priority: 3
func EnqueueInteractive(platform string, payload *VerificationJobPayload) (string, error) {
	return enqueueJob(platform, "interactive", payload)
}

// Priority: 2
func EnqueueAdminNow(platform string, payload *VerificationJobPayload) (string, error) {
	return enqueueJob(platform, "admin_now", payload)
}

// Priority: 1
func EnqueueBatch(platform string, payload *VerificationJobPayload) (string, error) {
	return enqueueJob(platform, "batch", payload)
}

// enqueueJob is the internal helper for enqueuing jobs.
func enqueueJob(platform, priority string, payload *VerificationJobPayload) (string, error) {
	if asynqClient == nil {
		return "", fmt.Errorf("asynq client not initialized")
	}

	// Serialize payload
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Create task
	task := asynq.NewTask("verification:process", payloadBytes)

	// Determine queue name: {platform}:{priority}
	queueName := fmt.Sprintf("%s:%s", platform, priority)

	// Enqueue options
	opts := []asynq.Option{
		asynq.Queue(queueName),
		asynq.MaxRetry(3),
		asynq.Timeout(10 * time.Minute),
	}

	// Enqueue task
	info, err := asynqClient.Enqueue(task, opts...)
	if err != nil {
		return "", fmt.Errorf("failed to enqueue task: %w", err)
	}

	return info.ID, nil
}

// CloseClient closes the Asynq client.
func CloseClient() error {
	if asynqClient != nil {
		return asynqClient.Close()
	}
	return nil
}
