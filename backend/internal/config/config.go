package config

import (
	"os"
)

type Config struct {
	GitHubToken      string
	CodeforcesKey    string
	CodeforcesSecret string
}

func LoadConfig() *Config {
	return &Config{
		GitHubToken:      os.Getenv("GITHUB_TOKEN"),
		CodeforcesKey:    os.Getenv("CODEFORCES_KEY"),
		CodeforcesSecret: os.Getenv("CODEFORCES_SECRET"),
	}
}
