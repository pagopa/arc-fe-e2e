import { test as base, Page } from '@playwright/test';
import { ARPU_BROKER_URL } from '../../../utils';
import * as fs from 'fs';

const AUTH_FILE = 'playwright/.auth/user.json';
const USERNAME = process.env.USER_USERNAME ?? '';
const PASSWORD = process.env.USER_PASSWORD ?? '';

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser }, use) => {
    const hasValidSession = fs.existsSync(AUTH_FILE);

    if (!hasValidSession) {
      console.log('No valid session found. Logging in...');

      const context = await browser.newContext();
      const page = await context.newPage();

      // --- LOGIN FLOW ---
      await page.goto(`${ARPU_BROKER_URL}/accesso`);
      await page.getByTestId('logInButton').click();

      await page.getByTestId('spidButton').click();
      await page.getByTestId('idp-button-https://idp.uat.oneid.pagopa.it').click();
      await page.getByLabel('Username').click();
      await page.getByLabel('Username').fill(USERNAME);
      await page.getByLabel('Password').click();
      await page.getByLabel('Password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Accedi' }).click();
      await page.getByRole('button', { name: 'Do il consenso' }).click();

      // Waiting for redirect to ARPU frontend
      await page.waitForURL(ARPU_BROKER_URL);

      // Saving state
      await context.storageState({ path: AUTH_FILE });
      await context.close();
    }

    console.log('Session found, creating context');
    const authContext = await browser.newContext({ storageState: AUTH_FILE });
    const authPage = await authContext.newPage();

    await use(authPage);
    await authContext.close();
  }
});
