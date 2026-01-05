package handlers

import (
	"net/http"
	"time"

	"github.com/boobachad/smart_form/backend/internal/db"

	"github.com/gin-gonic/gin"
)

func HealthCheck(c *gin.Context) {
	conn := db.GetPool()
	err := conn.Ping(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "error",
			"db":     "disconnected",
			"error":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"db":     "connected",
		"time":   time.Now(),
	})
}
