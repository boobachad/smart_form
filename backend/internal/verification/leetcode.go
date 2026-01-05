package verification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

const LeetCodeGraphQLEndpoint = "https://leetcode.com/graphql"

type LeetCodeClient struct {
	HttpClient *http.Client
}

func NewLeetCodeClient() *LeetCodeClient {
	transport, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		transport = &http.Transport{}
	}
	customTransport := transport.Clone()
	customTransport.MaxIdleConnsPerHost = 100
	return &LeetCodeClient{
		HttpClient: &http.Client{Transport: customTransport, Timeout: 5 * time.Second},
	}
}

// LeetCode Stats Response Structure.
type LeetCodeResponse struct {
	Data struct {
		MatchedUser struct {
			Username string `json:"username"`
			Profile  struct {
				Reputation int `json:"reputation"`
				Ranking    int `json:"ranking"`
			} `json:"profile"`
			SubmitStats struct {
				AcSubmissionNum []struct {
					Difficulty string `json:"difficulty"`
					Count      int    `json:"count"`
				} `json:"acSubmissionNum"`
			} `json:"submitStats"`
		} `json:"matchedUser"`
		UserContestRanking struct {
			Rating float64 `json:"rating"`
		} `json:"userContestRanking"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func (c *LeetCodeClient) FetchStats(ctx context.Context, username string) (map[string]any, error) {
	query := `
	query getUserProfile($username: String!) {
		matchedUser(username: $username) {
			username
			profile {
				ranking
				reputation
			}
			submitStats {
				acSubmissionNum {
					difficulty
					count
				}
			}
		}
		userContestRanking(username: $username) {
			rating
		}
	}`
	requestBody, err := json.Marshal(map[string]any{
		"query":     query,
		"variables": map[string]string{"username": username},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", LeetCodeGraphQLEndpoint, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "SmartForm-Verifier/1.0")
	req.Header.Set("Referer", "https://leetcode.com/")

	slog.Info("[SERVICE_API] LeetCode request", "username", username, "endpoint", LeetCodeGraphQLEndpoint)
	resp, err := c.HttpClient.Do(req)
	if err != nil {
		slog.Error("[SERVICE_API] LeetCode HTTP error", "username", username, "error", err)
		return nil, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			slog.Error("[SERVICE_API] Failed to close response body", "error", err)
		}
	}()

	slog.Info("[SERVICE_API] LeetCode response", "username", username, "status", resp.StatusCode)
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == 429 || resp.StatusCode == 503 {
			slog.Warn("[SERVICE_API] RATE_LIMITED - LeetCode rate limit", "username", username, "status", resp.StatusCode)
			return nil, fmt.Errorf("leetcode rate limited (HTTP %d)", resp.StatusCode)
		}
		slog.Error("[SERVICE_API] LeetCode API error", "username", username, "status", resp.StatusCode)
		return nil, fmt.Errorf("leetcode api status: %d", resp.StatusCode)
	}

	var lcResp LeetCodeResponse
	if err := json.NewDecoder(resp.Body).Decode(&lcResp); err != nil {
		return nil, err
	}

	if len(lcResp.Errors) > 0 {
		slog.Warn("[SERVICE_API] LeetCode GraphQL error", "username", username, "error", lcResp.Errors[0].Message)
		return nil, fmt.Errorf("graphql error: %s", lcResp.Errors[0].Message)
	}

	if lcResp.Data.MatchedUser.Username == "" {
		slog.Warn("[SERVICE_API] LeetCode user not found", "username", username)
		return nil, fmt.Errorf("user not found")
	}

	// Calculate total solved
	totalSolved := 0
	for _, item := range lcResp.Data.MatchedUser.SubmitStats.AcSubmissionNum {
		if item.Difficulty == "All" {
			totalSolved = item.Count
			break
		}
	}

	// Return normalized metrics map
	slog.Info("[SERVICE_API] LeetCode success", "username", username, "rating", int(lcResp.Data.UserContestRanking.Rating), "ranking", lcResp.Data.MatchedUser.Profile.Ranking, "solved", totalSolved)
	return map[string]any{
		"rating":       int(lcResp.Data.UserContestRanking.Rating),
		"ranking":      lcResp.Data.MatchedUser.Profile.Ranking,
		"solved_count": totalSolved,
	}, nil
}
