package verification

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/boobachad/smart_form/backend/internal/domain"
)

type VerificationEngine struct {
	LeetCode   *LeetCodeClient
	Codeforces *CodeforcesClient
	GitHub     *GitHubClient
}

func NewEngine() *VerificationEngine {
	return &VerificationEngine{
		LeetCode:   NewLeetCodeClient(),
		Codeforces: NewCodeforcesClient(),
		GitHub:     NewGitHubClient(),
	}
}

// VerifySubmission takes the form config and submitted data, and returns the updated UnifiedFieldState map.
func (e *VerificationEngine) VerifySubmission(ctx context.Context, fields []domain.FormField, state map[string]domain.UnifiedFieldState) (map[string]domain.UnifiedFieldState, error) {
	for _, field := range fields {
		if field.Type != "smart_field" || field.VerificationConfig == nil || field.VerificationConfig.Platform == "" {
			continue
		}

		fieldState, ok := state[field.ID]
		if !ok {
			continue // Field not present
		}

		state[field.ID] = e.verifySingleField(ctx, field, fieldState)
	}

	return state, nil
}

func (e *VerificationEngine) verifySingleField(ctx context.Context, field domain.FormField, fieldState domain.UnifiedFieldState) domain.UnifiedFieldState {
	claimedHandle := fieldState.ClaimedValue
	if claimedHandle == "" {
		return fieldState
	}

	// Short-circuit: if no metrics are requested, don't hit the API
	if len(field.VerificationConfig.Targets) == 0 {
		if fieldState.Verification == nil {
			fieldState.Verification = &domain.FieldVerificationState{}
		}
		fieldState.Verification.Status = "MATCH"
		fieldState.Verification.VerifiedStats = map[string]any{}
		fieldState.Verification.VerifiedAt = time.Now()
		return fieldState
	}

	// 2. Fetch Verified Data
	var verifiedMetrics map[string]any
	var err error

	switch field.VerificationConfig.Platform {
	case "leetcode":
		verifiedMetrics, err = e.LeetCode.FetchStats(ctx, claimedHandle)
	case "codeforces":
		verifiedMetrics, err = e.Codeforces.FetchStats(ctx, claimedHandle)
	case "github":
		verifiedMetrics, err = e.GitHub.FetchStats(ctx, claimedHandle)
	default:
		return fieldState
	}

	if fieldState.Verification == nil {
		fieldState.Verification = &domain.FieldVerificationState{}
	}

	if err != nil {
		fieldState.Verification.Status = "ERROR_RETRY"
		fieldState.Verification.VerifiedStats = map[string]any{"error": err.Error()}
	} else {
		fieldState.Verification.Status = "MATCH"

		// Filter metrics to only requested targets
		filteredMetrics := make(map[string]any)
		if len(field.VerificationConfig.Targets) > 0 {
			for _, target := range field.VerificationConfig.Targets {
				if val, ok := verifiedMetrics[target]; ok {
					filteredMetrics[target] = val
				}
			}
		} else {
			filteredMetrics = verifiedMetrics
		}

		fieldState.Verification.VerifiedStats = filteredMetrics
	}
	fieldState.Verification.VerifiedAt = time.Now()

	return fieldState
}

// VerifySingle performs an ad-hoc verification for a specific platform and handle.
func (e *VerificationEngine) VerifySingle(ctx context.Context, platform, handle string, targets []string) (map[string]any, error) {
	// Short-circuit: if no metrics are requested, don't hit the API
	if len(targets) == 0 {
		return map[string]any{}, nil
	}

	var metrics map[string]any
	var err error

	switch platform {
	case "leetcode":
		metrics, err = e.LeetCode.FetchStats(ctx, handle)
	case "codeforces":
		metrics, err = e.Codeforces.FetchStats(ctx, handle)
	case "github":
		metrics, err = e.GitHub.FetchStats(ctx, handle)
	default:
		return nil, fmt.Errorf("unsupported platform: %s", platform)
	}

	if err != nil {
		return nil, err
	}

	// Filter metrics to only requested targets
	if len(targets) > 0 {
		filteredMetrics := make(map[string]any)
		for _, target := range targets {
			if val, ok := metrics[target]; ok {
				filteredMetrics[target] = val
			}
		}
		return filteredMetrics, nil
	}

	return metrics, nil
}

// EvaluateVerdict determines if the submission is ELIGIBLE, INELIGIBLE based on rules.
func (e *VerificationEngine) EvaluateVerdict(fields []domain.FormField, state map[string]domain.UnifiedFieldState) string {
	if state == nil {
		return "PENDING"
	}

	for _, field := range fields {
		if field.Logic == nil || len(field.Logic.Criteria) == 0 {
			continue
		}

		status := evaluateFieldState(field, state)
		if status != "ELIGIBLE" {
			return status
		}
	}

	return "ELIGIBLE"
}

func evaluateFieldState(field domain.FormField, state map[string]domain.UnifiedFieldState) string {
	res, ok := state[field.ID]
	if !ok || res.Verification == nil || res.Verification.Status != "MATCH" {
		if res.Verification != nil && res.Verification.Status == "ERROR_RETRY" {
			return "PENDING"
		}
		return "INELIGIBLE"
	}

	metrics := res.Verification.VerifiedStats
	if metrics == nil {
		return "INELIGIBLE"
	}

	for _, rule := range field.Logic.Criteria {
		status := evaluateRule(rule, metrics)
		if status != "ELIGIBLE" {
			return status
		}
	}

	return "ELIGIBLE"
}

func evaluateRule(rule domain.Criterion, metrics map[string]any) string {
	val, exists := metrics[rule.Metric]
	if !exists {
		return "INELIGIBLE"
	}

	numVal, status := parseMetricValue(val)
	if status != "ELIGIBLE" {
		return status
	}

	if checkThreshold(rule.Operator, numVal, rule.Threshold) {
		return "ELIGIBLE"
	}
	return "INELIGIBLE"
}

func parseMetricValue(val any) (float64, string) {
	switch v := val.(type) {
	case int:
		return float64(v), "ELIGIBLE"
	case float64:
		return v, "ELIGIBLE"
	case string:
		// Attempt to parse string-wrapped numbers (e.g. API changes)
		parsed, err := strconv.ParseFloat(v, 64)
		if err != nil {
			// It's a provider issue or unknown type.mark as PENDING for admin review.
			return 0, "PENDING"
		}
		return parsed, "ELIGIBLE"
	default:
		// Unparseable complex type from provider.
		return 0, "PENDING"
	}
}

func checkThreshold(operator string, actual, threshold float64) bool {
	switch operator {
	case "gte":
		return actual >= threshold
	case "gt":
		return actual > threshold
	case "lte":
		return actual <= threshold
	case "lt":
		return actual < threshold
	case "eq":
		return actual == threshold
	}
	return false
}
