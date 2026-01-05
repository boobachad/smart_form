package config

import (
	"github.com/boobachad/smart_form/backend/internal/domain"
)

func GetSystemCapabilities() map[string]domain.SystemCapability {
	cfg := LoadConfig()

	caps := make(map[string]domain.SystemCapability)

	caps["leetcode"] = domain.SystemCapability{
		DisplayName: "LeetCode",
		Status:      "OPERATIONAL",
		Features: domain.PlatformFeature{
			ClientFetchSupported: true,
		},
		SupportedMetrics: []domain.SupportedMetric{
			{Key: "rating", Label: "Contest Rating", Type: "number"},
			{Key: "solved_count", Label: "Total Solved", Type: "number"},
			{Key: "ranking", Label: "Global Ranking", Type: "number"},
		},
	}

	cfStatus := "OPERATIONAL"
	cfReason := ""
	cfFetch := true

	caps["codeforces"] = domain.SystemCapability{
		DisplayName:       "Codeforces",
		Status:            cfStatus,
		UnavailableReason: cfReason,
		Features: domain.PlatformFeature{
			ClientFetchSupported: cfFetch,
		},
		SupportedMetrics: []domain.SupportedMetric{
			{Key: "rating", Label: "Current Rating", Type: "number"},
			{Key: "max_rating", Label: "Max Rating", Type: "number"},
		},
	}

	ghStatus := "OPERATIONAL"
	ghReason := ""
	ghFetch := true

	if cfg.GitHubToken == "" {
		ghStatus = "PARTIAL_OUTAGE"
		ghReason = "Missing GITHUB_TOKEN. Rate limits severely restricted."
		ghFetch = false // Disable auto-fetch here cause of public endpoint
	}

	caps["github"] = domain.SystemCapability{
		DisplayName:       "GitHub",
		Status:            ghStatus,
		UnavailableReason: ghReason,
		Features: domain.PlatformFeature{
			ClientFetchSupported: ghFetch,
		},
		SupportedMetrics: []domain.SupportedMetric{
			{Key: "followers", Label: "Followers", Type: "number"},
		},
	}

	return caps
}
