package verification

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/boobachad/smart_form/backend/internal/config"
)

type GitHubClient struct {
	HttpClient *http.Client
	Token      string
}

func NewGitHubClient() *GitHubClient {
	transport, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		transport = &http.Transport{}
	}
	customTransport := transport.Clone()
	customTransport.MaxIdleConnsPerHost = 100
	return &GitHubClient{
		HttpClient: &http.Client{Transport: customTransport, Timeout: 5 * time.Second},
		Token:      config.LoadConfig().GitHubToken,
	}
}

func (c *GitHubClient) FetchStats(ctx context.Context, username string) (map[string]any, error) {
	url := fmt.Sprintf("https://api.github.com/users/%s", username)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}

	resp, err := c.HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			slog.Error("[SERVICE_API] Failed to close response body", "error", err)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github api status: %d", resp.StatusCode)
	}

	var user struct {
		Followers int `json:"followers"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}

	return map[string]any{
		"followers": user.Followers,
	}, nil
}
