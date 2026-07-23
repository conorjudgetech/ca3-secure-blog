const { defineConfig } = require('@playwright/test');

// Playwright starts the app on a dedicated port with a dedicated database, so the tests never
// touch a development database. Tests run one at a time because the app uses one SQLite file and
// the tests share state, so parallel runs would be flaky.
const PORT = 3400;
const TEST_DB = 'data/test.db';

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    screenshot: 'off',
    trace: 'off',
    video: 'off'
  },
  webServer: {
    command: 'node scripts/init-db.js && node server.js',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      PORT: String(PORT),
      DB_PATH: TEST_DB,
      NODE_ENV: 'test'
    }
  }
});
