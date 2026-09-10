// CI deploy gate: retry transient browser automation failures once.
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  expect: { timeout: 6000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'artifacts/tests.json' }]],
  use: { ignoreHTTPSErrors:true, baseURL: 'https://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { ignoreHTTPSErrors:true, command: 'node tools/fixture-server.mjs', url: 'https://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
  projects: ['chromium', 'webkit'].flatMap(browserName => [
    { name: browserName + '-desktop', use: { browserName, viewport: { width:1440,height:900 } } },
    { name: browserName + '-390', use: { browserName, viewport: { width:390,height:844 }, isMobile:true, hasTouch:true } },
    { name: browserName + '-430', use: { browserName, viewport: { width:430,height:932 }, isMobile:true, hasTouch:true } }
  ])
});
