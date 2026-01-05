package firebase

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"sync"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

var (
	AuthClient *auth.Client
	initOnce   sync.Once
)

func InitFirebase() {
	initOnce.Do(func() {
		credsFile := os.Getenv("FIREBASE_CREDENTIALS_FILE")
		if credsFile == "" {
			slog.Info("Warning: FIREBASE_CREDENTIALS_FILE not set")
			return
		}

		opt := option.WithCredentialsFile(credsFile)
		app, err := firebase.NewApp(context.Background(), nil, opt)
		if err != nil {
			slog.Info("Warning: Firebase Init failed (Check credentials file): " + err.Error())
			return
		}

		client, err := app.Auth(context.Background())
		if err != nil {
			slog.Info("Warning: Firebase Auth Client failed: " + err.Error())
			return
		}

		AuthClient = client
		slog.Info("Firebase Auth Initialized")
	})
}

func VerifyIDToken(ctx context.Context, idToken string) (*auth.Token, error) {
	InitFirebase()
	if AuthClient == nil {
		slog.Info("VerifyIDToken: Firebase client is nil")
		return nil, errors.New("firebase auth not initialized")
	}
	return AuthClient.VerifyIDToken(ctx, idToken)
}
