package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/boobachad/smart_form/backend/internal/api"
	"github.com/boobachad/smart_form/backend/internal/db"
	"github.com/boobachad/smart_form/backend/internal/firebase"
	"github.com/boobachad/smart_form/backend/internal/queue"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/hibiken/asynq"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		slog.Info("No .env file found, using system environment variables")
	}

	if err := db.InitDB(); err != nil {
		slog.Error("Failed to initialize database: " + err.Error())
		os.Exit(1)
	}
	firebase.InitFirebase()

	// Initialize Redis
	if err := db.InitRedis(); err != nil {
		slog.Error("Failed to initialize Redis: " + err.Error())
		os.Exit(1)
	}
	slog.Info("Redis connected")

	// Initialize Asynq client
	if err := queue.InitClient(db.GetRedisClient()); err != nil {
		slog.Error("Failed to initialize Asynq client: " + err.Error())
		os.Exit(1)
	}

	mux := asynq.NewServeMux()
	queue.RegisterHandlers(mux)

	// Start LeetCode worker
	workerLeetCode := queue.NewLeetCodeWorker(db.GetRedisClient())
	go func() {
		slog.Info("Starting LeetCode worker...")
		if err := workerLeetCode.Run(mux); err != nil {
			slog.Error("LeetCode worker failed: " + err.Error())
			os.Exit(1)
		}
	}()

	// Start Codeforces worker
	workerCodeforces := queue.NewCodeforcesWorker(db.GetRedisClient())
	go func() {
		slog.Info("Starting Codeforces worker...")
		if err := workerCodeforces.Run(mux); err != nil {
			slog.Error("Codeforces worker failed: " + err.Error())
			os.Exit(1)
		}
	}()

	// Start GitHub worker
	workerGitHub := queue.NewGitHubWorker(db.GetRedisClient())
	go func() {
		slog.Info("Starting GitHub worker...")
		if err := workerGitHub.Run(mux); err != nil {
			slog.Error("GitHub worker failed: " + err.Error())
			os.Exit(1)
		}
	}()

	// Run orphaned lock recovery on startup
	slog.Info("Running orphaned lock recovery...")
	queue.RecoverOrphanedLocks()

	// Schedule periodic orphaned lock cleanup (every 5 minutes)
	ctxCleanup, cancelCleanup := context.WithCancel(context.Background())
	go queue.ScheduleOrphanedLockCleanup(ctxCleanup)

	slog.Info("Backend started [Go/Gin]")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0"
	}

	addr := host + ":" + port

	r := gin.Default()

	// Add CORS
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{
		"http://localhost:5173",
		"http://localhost:3000",
		"http://smart-form.localhost:1355",
		"https://smart-form.localhost:1355",
		"https://smart-form.localhost",
		"http://smart-form.localhost",
		"http://127.0.0.1:4778",
	}
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "X-Csrf-Token", "X-Idempotency-Key", "Idempotency-Key", "idempotency-key"}
	config.AllowCredentials = true
	r.Use(cors.New(config))

	api.SetupRoutes(r)

	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("listen: " + err.Error())
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down server...")

	// Shutdown workers
	cancelCleanup()
	workerLeetCode.Shutdown()
	workerCodeforces.Shutdown()
	workerGitHub.Shutdown()
	if err := queue.CloseClient(); err != nil {
		slog.Error("Failed to close queue client: " + err.Error())
	}
	if err := db.CloseRedis(); err != nil {
		slog.Error("Failed to close Redis client: " + err.Error())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown: " + err.Error())
		os.Exit(1)
	}

	slog.Info("Server exiting")
}
