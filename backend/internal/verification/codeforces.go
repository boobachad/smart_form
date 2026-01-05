package verification

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

type CodeforcesClient struct {
	HttpClient *http.Client
}

func NewCodeforcesClient() *CodeforcesClient {
	transport, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		transport = &http.Transport{}
	}
	customTransport := transport.Clone()
	customTransport.MaxIdleConnsPerHost = 100
	return &CodeforcesClient{
		HttpClient: &http.Client{Transport: customTransport, Timeout: 5 * time.Second},
	}
}

func (c *CodeforcesClient) FetchStats(ctx context.Context, handle string) (map[string]any, error) {
	// Public API: https://codeforces.com/api/user.info?handles={handle}
	url := fmt.Sprintf("https://codeforces.com/api/user.info?handles=%s", handle)

	slog.Info("[SERVICE_API] Codeforces request", "handle", handle, "url", url)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.HttpClient.Do(req)
	if err != nil {
		slog.Error("[SERVICE_API] Codeforces HTTP error", "handle", handle, "error", err)
		return nil, fmt.Errorf("failed to reach Codeforces API: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			slog.Error("[SERVICE_API] Failed to close response body", "error", err)
		}
	}()

	slog.Info("[SERVICE_API] Codeforces response", "handle", handle, "status", resp.StatusCode)
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == 429 || resp.StatusCode == 503 {
			slog.Warn("[SERVICE_API] RATE_LIMITED - Codeforces rate limit", "handle", handle, "status", resp.StatusCode)
			return nil, fmt.Errorf("codeforces rate limited (HTTP %d)", resp.StatusCode)
		}
		slog.Error("[SERVICE_API] Codeforces API error", "handle", handle, "status", resp.StatusCode)
		return nil, fmt.Errorf("codeforces api status: %d", resp.StatusCode)
	}

	var result struct {
		Status string `json:"status"`
		Result []struct {
			Rating    int `json:"rating"`
			MaxRating int `json:"maxRating"`
		} `json:"result"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Status != "OK" || len(result.Result) == 0 {
		slog.Warn("[SERVICE_API] Codeforces user not found or API error", "handle", handle, "status", result.Status)
		return nil, fmt.Errorf("user not found or api error")
	}

	user := result.Result[0]
	slog.Info("[SERVICE_API] Codeforces success", "handle", handle, "rating", user.Rating, "max_rating", user.MaxRating)
	return map[string]any{
		"rating":     user.Rating,
		"max_rating": user.MaxRating,
	}, nil
}
