import { test as setup, expect, Page } from '@playwright/test';
import { skipAuth, userPath } from '../utils';
import path from 'path';

const authFile = path.join(__dirname, `../${userPath}`);

const executeLoginSteps = async (page: Page) => {
  const username = process.env?.USERNAME;
  const password = process.env?.PASSWORD;
  expect(username).toBeTruthy();
  expect(password).toBeTruthy();

  if (!(username && password)) { throw new Error('Setup has failed, missing username and/or password!');}
  await page.goto('/');
  await page.goto('/pagamenti/login');
  await page.getByRole('button', { name: 'Accetta tutti' }).click();
  await page.getByLabel('Accedi').click();
  await page.getByRole('button', { name: 'Entra con SPID' }).click();
  await page.getByTestId('idp-button-https://demo.spid.gov.it').click();
  await page.waitForURL('**/start');
  await expect(page.locator('#username')).toBeVisible({ timeout: 20000 });
  await page.locator('#username').click();
  await page.locator('#username').fill(username);
  await page.locator('#username').press('Tab');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Entra con SPID' }).click();
  await page.getByRole('button', { name: 'Conferma' }).click();
}

const saveState = async (page: Page) => {
  await page.waitForURL('**/pagamenti/');
  await expect(page.getByLabel('app.dashboard.greeting')).toBeVisible();
  const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
  expect(accessToken).toBeTruthy();
  // storing user contex
  await page.context().storageState({ path: authFile });
}

// LOCALHOST
// This setup is to be used when tests are launched pointing to a local environment
// it is necessary to have a dedicated and different step respecting the dev or uat environment
// because the external oneIdentity authentication service always redirects to a specific environment (dev or uat)
// and does not expect a return to locahost. For this reason the page.route section provided to intercept the return,
// abort the call to obtain the token (under penalty of invalidation) and redirect correctly to localhost
// so that when the flow ends, an auth/user.json file is produced for the correct environment (localhost)
setup(
  "[E2E-ARC-1] localhost: Come Cittadino voglio autenticarmi nell' Area Riservata Cittadino per poter usufruire dei servizi offerti",
  async ({ page }) => {
    setup.skip(await skipAuth() ? true : process.env.BASE_URL?.includes('cittadini') as boolean);

    await page.route(
      '**/token/oneidentity*',
      async (route, request) => {
        const url = new URL(page.url())
        if( url.hostname.includes('cittadini.pagopa.it')) {
          const { search } = new URL(request.url());
          await page.goto(`/pagamenti/auth-callback${search}`);
        } else {
          await route.continue();
        }
      }
    );

    await executeLoginSteps(page);
    // waitForTimeout should not be used in production, Tests that wait for time are inherently flaky.
    // unfortunately this is the only way to make this test works properly, actually
    // we should find a more solid solution
    await page.waitForTimeout(3*1000);
    await saveState(page);
  }
);

// DEV, UAT
setup(
  "[E2E-ARC-1] Come Cittadino voglio autenticarmi nell' Area Riservata Cittadino per poter usufruire dei servizi offerti",
  async ({ page }) => {
    setup.skip(await skipAuth() ? true : process.env.BASE_URL?.includes('localhost') as boolean);
    await executeLoginSteps(page);
    await saveState(page);
  }
);
