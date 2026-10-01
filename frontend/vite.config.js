import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Django runs on :8000 in development; same-origin /api calls need no CORS setup.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Django not running: answer 503 with a message the app shows, instead
        // of a bare 500 ("Request to /auth/login/ failed with status 500").
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res.headersSent) return;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                detail:
                  'The Cardio Sense server isn’t running. Start it with `python manage.py runserver` in backend/, then try again.',
              }),
            );
          });
        },
      },
    },
  },
});
