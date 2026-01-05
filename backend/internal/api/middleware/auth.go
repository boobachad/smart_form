package middleware

import (
	"context"
	"net/http"

	"github.com/boobachad/smart_form/backend/internal/db"
	"github.com/boobachad/smart_form/backend/internal/firebase"
	"github.com/gin-gonic/gin"
)

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, err := c.Cookie("jwt")
		if err != nil || tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// Verify token with Firebase Admin SDK, Abort if err != nil.
		decodedToken, err := firebase.VerifyIDToken(context.Background(), tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		// Valid Token
		c.Set("firebase_uid", decodedToken.UID)

		// Extract email if available in claims
		if email, ok := decodedToken.Claims["email"].(string); ok {
			c.Set("email", email)
		}
		if name, ok := decodedToken.Claims["name"].(string); ok {
			c.Set("name", name)
		}

		// Connect to DB and fetch user details for authorization
		conn := db.GetPool()
		var userID string
		var role uint32

		err = conn.QueryRow(c.Request.Context(), `SELECT id, role FROM users WHERE firebase_uid = $1`, decodedToken.UID).Scan(&userID, &role)
		if err == nil {
			c.Set("user_id", userID)
			c.Set("role", role)
		}

		c.Next()
	}
}

func RoleRequired(requiredRole uint32) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		roleVal, ok := role.(uint32)
		if !exists || !ok || (roleVal&requiredRole) == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			c.Abort()
			return
		}
		c.Next()
	}
}
