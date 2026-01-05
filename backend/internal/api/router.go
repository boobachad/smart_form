package api

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/boobachad/smart_form/backend/internal/api/handlers"
	"github.com/boobachad/smart_form/backend/internal/api/middleware"
	"github.com/boobachad/smart_form/backend/internal/domain"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	csrf "github.com/utrack/gin-csrf"
)

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Next()
	}
}

func SetupRoutes(r *gin.Engine) {
	// Security Headers
	r.Use(SecurityHeaders())

	// Sessions and CSRF
	store := cookie.NewStore([]byte(os.Getenv("SESSION_SECRET_KEY")))
	store.Options(sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 30,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteNoneMode,
	})
	r.Use(sessions.Sessions("mysession", store))
	r.Use(csrf.Middleware(csrf.Options{
		Secret: os.Getenv("CSRF_SECRET_KEY"),
		ErrorFunc: func(c *gin.Context) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "CSRF token mismatch"})
		},
	}))

	// Health Check
	r.GET("/health", handlers.HealthCheck)

	api := r.Group("/api/v1")
	{
		// CSRF Token Endpoint
		api.GET("/csrf", func(c *gin.Context) {
			token := csrf.GetToken(c)
			session := sessions.Default(c)
			if err := session.Save(); err != nil {
				slog.Error("Failed to save session for CSRF token", "error", err)
			}
			c.JSON(http.StatusOK, gin.H{"csrfToken": token})
		})

		// Public Auth Routes
		auth := api.Group("/auth")
		{
			auth.POST("/google-login", handlers.GoogleLogin)
		}

		// Protected Routes
		protected := api.Group("/")
		protected.Use(middleware.AuthRequired())
		{
			protected.GET("/auth/me", handlers.GetMe)

			// Forms public/fill
			protected.GET("/forms/:id", handlers.GetForm)
			protected.POST("/forms/:id/submit", handlers.SubmitForm)
			protected.GET("/forms/:id/my-submission", handlers.GetMySubmission)

			// System
			protected.GET("/system/capabilities", handlers.GetSystemCapabilities)

			// Creator Routes
			creator := protected.Group("/")
			creator.Use(middleware.RoleRequired(domain.RoleCreator))
			{
				// Forms CRUD
				creator.POST("/forms", handlers.CreateForm)
				creator.GET("/forms", handlers.ListForms)
				creator.DELETE("/forms/:id", handlers.DeleteForm)
				creator.PUT("/forms/:id", handlers.UpdateForm)
				creator.PATCH("/forms/:id/status", handlers.UpdateFormStatus)
				creator.GET("/forms/:id/manage", handlers.GetFormManage)

				// Submissions & Verification
				creator.GET("/forms/:id/submissions", handlers.GetSubmissions)
				creator.DELETE("/forms/:id/submissions", handlers.DeleteSubmissions)
				creator.POST("/forms/:id/submissions/flag", handlers.FlagSubmissions)
				creator.POST("/forms/:id/verify", handlers.VerifySubmissions)

				// Queue System (Async Verification)
				creator.POST("/forms/:id/verify-async", handlers.EnqueueVerification)
				creator.POST("/forms/:id/verify-preview", handlers.EnqueueVerificationPreview)
				creator.GET("/jobs/:id/status", handlers.GetJobStatus)
			}
		}
	}
}
