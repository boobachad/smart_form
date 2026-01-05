package handlers

import (
	"context"
	"regexp"
	"strings"

	"github.com/boobachad/smart_form/backend/internal/db"
	"github.com/boobachad/smart_form/backend/internal/domain"
	"github.com/google/uuid"
)

// CheckAccessControl enforces form access gatekeeper rules for respondents.
// Returns true if access is allowed, false otherwise.
// NOTE: This should NOT be called for owners - callers must skip for owners.
func CheckAccessControl(accessControl domain.AccessControl, userEmail string, isOwner bool) (bool, string) {
	if accessControl.Mode == "PUBLIC" || accessControl.Mode == "" {
		return true, ""
	}

	if accessControl.Mode == "DOMAIN_RESTRICTED" {
		return checkDomainRestricted(accessControl, userEmail)
	}

	if accessControl.Mode == "REGEX_MATCH" {
		return checkRegexMatch(accessControl, userEmail)
	}

	return true, ""
}

func checkDomainRestricted(accessControl domain.AccessControl, userEmail string) (bool, string) {
	if len(accessControl.Rules.AllowedDomains) == 0 {
		return true, ""
	}

	userDomain := extractDomain(userEmail)
	for _, allowedDomain := range accessControl.Rules.AllowedDomains {
		if strings.EqualFold(userDomain, allowedDomain) {
			return true, ""
		}
	}

	message := accessControl.BlockMessage
	if message == "" {
		message = "Access denied: Your email domain is not authorized"
	}
	return false, message
}

func checkRegexMatch(accessControl domain.AccessControl, userEmail string) (bool, string) {
	if accessControl.Rules.RegexPattern == "" {
		return true, ""
	}

	matched, err := regexp.MatchString(accessControl.Rules.RegexPattern, userEmail)
	if err != nil {
		return false, "Invalid access control configuration"
	}

	if !matched {
		message := accessControl.BlockMessage
		if message == "" {
			message = "Access denied: Your email does not match the required pattern"
		}
		return false, message
	}

	return true, ""
}

// extractDomain extracts domain from email address.
func extractDomain(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) == 2 {
		return strings.ToLower(parts[1])
	}
	return ""
}

// getUserEmail fetches email for a user ID.
func getUserEmail(ctx context.Context, userID *uuid.UUID) (string, error) {
	if userID == nil {
		return "", nil
	}

	conn := db.GetPool()
	var email string
	err := conn.QueryRow(ctx, "SELECT email FROM users WHERE id = $1", userID).Scan(&email)
	if err != nil {
		return "", err
	}
	return email, nil
}
