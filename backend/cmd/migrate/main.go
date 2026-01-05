package main

import (
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"regexp"
	"strings"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(".env"); err != nil {
		slog.Info("Note: Could not load .env file, checking environment variables...")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		slog.Error("DATABASE_URL is not set")
		os.Exit(1)
	}

	parsedURL, err := url.Parse(dbURL)
	if err != nil {
		slog.Error(err.Error())
		os.Exit(1)
	}

	dbname := strings.TrimPrefix(parsedURL.Path, "/")
	if dbname == "" {
		dbname = "smart_form"
	}
	if !regexp.MustCompile(`^[a-zA-Z0-9_]+$`).MatchString(dbname) {
		slog.Error(fmt.Sprintf("Invalid database name: %s", dbname))
		os.Exit(1)
	}

	postgresURL := *parsedURL
	postgresURL.Path = "/postgres"

	db, err := sql.Open("pgx", postgresURL.String())
	if err != nil {
		slog.Error(err.Error())
		os.Exit(1)
	}

	ensureDatabaseExists(db, dbname)
	if closeErr := db.Close(); closeErr != nil {
		slog.Error("Failed to close db: " + closeErr.Error())
	}

	fmt.Printf("Connecting to '%s' to apply schema...\n", dbname)
	targetDB, err := sql.Open("pgx", dbURL)
	if err != nil {
		slog.Error(err.Error())
		os.Exit(1)
	}

	applySchemas(targetDB)
	if closeErr := targetDB.Close(); closeErr != nil {
		slog.Error("Failed to close targetDB: " + closeErr.Error())
	}

	fmt.Println("Migrations completed.")
}

func ensureDatabaseExists(db *sql.DB, dbname string) {
	fmt.Printf("Checking if database '%s' exists...\n", dbname)
	var exists int
	err := db.QueryRow(fmt.Sprintf("SELECT 1 FROM pg_database WHERE datname = '%s'", dbname)).Scan(&exists)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		fmt.Printf("Warning checking db: %v\n", err)
	}

	if exists == 0 {
		fmt.Printf("Creating database '%s'...\n", dbname)
		_, err = db.Exec(fmt.Sprintf("CREATE DATABASE \"%s\"", dbname))
		if err != nil {
			fmt.Printf("Error creating DB (might exist): %v\n", err)
		} else {
			fmt.Println("Database created successfully.")
		}
	} else {
		fmt.Println("Database already exists.")
	}
}

func applySchemas(targetDB *sql.DB) {
	files, err := os.ReadDir("internal/db/schema")
	if err != nil {
		slog.Error(err.Error())
		os.Exit(1)
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".sql") {
			fmt.Printf("Applying %s...\n", file.Name())
			content, err := os.ReadFile("internal/db/schema/" + file.Name())
			if err != nil {
				slog.Info(fmt.Sprintf("Failed to read %s: %v", file.Name(), err))
				continue
			}

			if _, err = targetDB.Exec(string(content)); err != nil {
				slog.Info(fmt.Sprintf("Warning applying %s: %v", file.Name(), err))
			}
		}
	}
}
