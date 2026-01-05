package handlers

import (
	"net/http"

	"github.com/boobachad/smart_form/backend/internal/config"
	"github.com/gin-gonic/gin"
)

func GetSystemCapabilities(c *gin.Context) {
	caps := config.GetSystemCapabilities()
	c.JSON(http.StatusOK, caps)
}
