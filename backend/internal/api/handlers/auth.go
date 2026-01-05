package handlers

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/boobachad/smart_form/backend/internal/db"
	"github.com/boobachad/smart_form/backend/internal/domain"
	"github.com/boobachad/smart_form/backend/internal/firebase"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type GoogleLoginRequest struct {
	IDToken string `json:"token" binding:"required"`
}

func GoogleLogin(c *gin.Context) {
	var req GoogleLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token is required"})
		return
	}

	token, err := firebase.VerifyIDToken(c.Request.Context(), req.IDToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Firebase Token"})
		return
	}

	firebaseUID := token.UID
	claims := token.Claims
	email, ok := claims["email"].(string)
	if !ok || email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required from token claims"})
		return
	}

	conn := db.GetPool()

	// Check if user exists by firebase_uid
	sqlSelect := `SELECT id, role FROM users WHERE firebase_uid = $1`

	var user domain.User

	err = conn.QueryRow(c.Request.Context(), sqlSelect, firebaseUID).Scan(&user.ID, &user.Role)

	if errors.Is(err, pgx.ErrNoRows) {
		// CREATE NEW USER
		slog.Info("Creating new user", "email", email)
		role := domain.RoleStandard // Default
		sqlInsert := `INSERT INTO users (email, firebase_uid, role) VALUES ($1, $2, $3) RETURNING id, created_at`
		err = conn.QueryRow(c.Request.Context(), sqlInsert, email, firebaseUID, role).Scan(&user.ID, &user.CreatedAt)
		if err != nil {
			slog.Error("Error creating user", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}
		user.Role = role
	} else if err != nil {
		slog.Error("DB Error", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Mint a secure session cookie
	c.SetCookie(
		"jwt",       // name
		req.IDToken, // value
		3600,        // maxAge (seconds)
		"/",         // path
		"",          // domain (empty for current host)
		true,        // secure (HTTPS only)
		true,        // httpOnly (prevent JS access)
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"user": gin.H{
			"id":    user.ID,
			"email": email,
			"role":  user.Role,
		},
		"token": req.IDToken,
	})
}

func GetMe(c *gin.Context) {

	firebaseUID, exists := c.Get("firebase_uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	conn := db.GetPool()
	var user domain.User

	sql := `SELECT id, email, role, created_at, firebase_uid FROM users WHERE firebase_uid = $1`

	err := conn.QueryRow(c.Request.Context(), sql, firebaseUID).Scan(&user.ID, &user.Email, &user.Role, &user.CreatedAt, &user.FirebaseUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}
