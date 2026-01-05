package db

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	pool *pgxpool.Pool
	once sync.Once
)

// InitDB initializes the database connection pool.
func InitDB() error {
	var err error
	once.Do(func() {
		dsn := os.Getenv("DATABASE_URL")
		if dsn == "" {
			err = fmt.Errorf("DATABASE_URL environment variable is not set")
			return
		}

		config, parseErr := pgxpool.ParseConfig(dsn)
		if parseErr != nil {
			err = fmt.Errorf("unable to parse database config: %w", parseErr)
			return
		}

		config.MaxConns = 50
		config.MinConns = 10
		config.MaxConnLifetime = 1 * time.Hour
		config.MaxConnIdleTime = 30 * time.Minute

		pool, err = pgxpool.NewWithConfig(context.Background(), config)
		if err != nil {
			err = fmt.Errorf("unable to create connection pool: %w", err)
			return
		}

		// Verify connection
		if pingErr := pool.Ping(context.Background()); pingErr != nil {
			err = fmt.Errorf("unable to ping database: %w", pingErr)
			return
		}

		slog.Info("Database connected [PostgreSQL]", "database", config.ConnConfig.Database)
	})

	return err
}

// GetPool returns the database connection pool.
func GetPool() *pgxpool.Pool {
	return pool
}

// CloseDB closes the database connection pool.
func CloseDB() {
	if pool != nil {
		pool.Close()
	}
}
