import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
	server: {
		host: process.env.HOST || "localhost",
		port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
		strictPort: true,
		proxy: {
			"/api": {
				target: "https://api.smart-form.localhost:1355",
				changeOrigin: true,
			},
		},
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					firebase: ['firebase/app', 'firebase/auth']
				}
			}
		}
	}
});
