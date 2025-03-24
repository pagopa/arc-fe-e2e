import { test as setup, expect, Page } from '@playwright/test';
import { skipAuth, userPath } from '../utils';
import path from 'path';

const authFile = path.join(__dirname, `../${userPath}`);
let searchParam = '';

const executeLoginSteps = async (page: Page) => {
  const username = process.env?.USERNAME;
  const password = process.env?.PASSWORD;
  const identity_provider_button_test_id = process.env?.IDENTITY_PROVIDER_BUTTON_TEST_ID;

  expect(username).toBeTruthy();
  expect(password).toBeTruthy();
  expect(identity_provider_button_test_id).toBeTruthy();

  if (!(username && password && identity_provider_button_test_id)) {
    throw new Error(
      'Setup has failed, missing username or password or identity provider button id!'
    );
  }
  await page.goto('/');
  await page.goto('/pagamenti/accesso');
  await page.getByTestId('spidButton').click();
  await page.getByTestId(identity_provider_button_test_id).click();
  await page.waitForURL('**/start');
  await expect(page.locator('#username')).toBeVisible({ timeout: 20000 });
  await page.locator('#username').click();
  await page.locator('#username').fill(username);
  await page.locator('#username').press('Tab');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Entra con SPID' }).click();
  await page.getByRole('button', { name: 'Conferma' }).click();
};

const saveState = async (page: Page) => {
  // this means we are logged in on the main dashboard page
  await expect(page.getByLabel('app.dashboard.greeting')).toBeVisible();
  const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
  expect(accessToken).toBeTruthy();
  // storing user contex
  await page.context().storageState({ path: authFile });
};

setup(
  "[E2E-ARC-1] Come Cittadino voglio autenticarmi nell' Area Riservata Cittadino per poter usufruire dei servizi offerti",
  async ({ page }) => {
    setup.skip(await skipAuth());

    // LOCALHOST
    // This route is used when tests are launched pointing to a local environment
    // it is necessary because oneIdentity auth service always redirects to a specific environment (dev or uat)
    // For this reason the page.route section provided to intercept the return,
    // abort the call to obtain the token (under penalty of invalidation) and redirect correctly to localhost
    // so that when the flow ends, an auth/user.json file is produced for the correct environment (localhost)
    page.route(
      '**/token/oneidentity*',
      async (route, request) => {
        if (process.env.BASE_URL?.includes('localhost')) {
          const { search } = new URL(request.url());
          searchParam = search;
          // Abort the current hit
          await route.abort();
          await page.waitForURL('**/errore/**');
          // Redirect to the local auth-callback
          await page.goto(`/pagamenti/auth-callback${searchParam}`);
        }
      },
      { times: 1 }
    );

    await executeLoginSteps(page);

    await saveState(page);
  }
);
