package db

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"

	"github.com/redis/go-redis/v9"
)

var (
	redisClient *redis.Client
	redisOnce   sync.Once
)

// InitRedis initializes the Redis connection.
func InitRedis() error {
	var err error
	redisOnce.Do(func() {
		redisURL := os.Getenv("REDIS_URL")
		if redisURL == "" {
			redisURL = "redis://localhost:6379/0"
		}

		opt, parseErr := redis.ParseURL(redisURL)
		if parseErr != nil {
			err = fmt.Errorf("unable to parse Redis URL: %w", parseErr)
			return
		}

		redisClient = redis.NewClient(opt)

		// Verify connection
		if pingErr := redisClient.Ping(context.Background()).Err(); pingErr != nil {
			err = fmt.Errorf("unable to connect to Redis: %w", pingErr)
			return
		}

		slog.Info("Redis connected", "addr", opt.Addr)
	})

	return err
}

// GetRedisClient returns the Redis client instance.
func GetRedisClient() *redis.Client {
	return redisClient
}

// CloseRedis closes the Redis connection.
func CloseRedis() error {
	if redisClient != nil {
		return redisClient.Close()
	}
	return nil
}
