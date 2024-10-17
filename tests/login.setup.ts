import { test as setup, expect } from '@playwright/test';
import { skipAuth, userPath } from '../utils';
import path from 'path';

const authFile = path.join(__dirname, `../${userPath}`);

const commonStep = async (page) => {
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
  await page.waitForURL('/pagamenti/auth-callback*');
}

// LOCALHOST
// Questo setup è da utilizzarsi quando i test vengono lanciati puntando ad un'abiente locale
// è necessario avere uno step dedicato e differente rispetta all'ambiente dev o uat
// perchè il servizio esterno di autenticazione oneIdentity ridirigge a sempre ad uno specifico ambiente (dev o uat)
// e non prevede un ritorno su locahost. Per questo motivo la sezione page.route provedde and intercettare il ritorno,
// ad abortire la chiamata per l'ottenimento del token (pena l'ivalidamento) e redirigere correttamente su localhost
// così che al termine del flusso, venga prodotto un file auth/user.json per l'ambiente corretto (localhost)
setup(
  "[E2E-ARC-1] local: Come Cittadino voglio autenticarmi nell' Area Riservata Cittadino per poter usufruire dei servizi offerti",
  async ({ page }) => {
    setup.skip(await skipAuth() ? true : process.env.BASE_URL?.includes('cittadini') as boolean,
      'Non è necessario autenticarsi più volte, sopratutto durante le fasi di sviluppo e debug'
    );

    await page.route(
      '**/token/oneidentity*',
      async (route, request) => {
        console.log('fire')
        const url = new URL(page.url())
        if( url.hostname.includes('cittadini.pagopa.it')) {
          await route.abort();
          const { search } = new URL(request.url());
          page.goto(`http://localhost:1234/pagamenti/auth-callback${search}`);
        } else {
          await route.continue();
        }
      }
    );

    await commonStep(page);

    //await page.waitForURL('/pagamenti/auth-callback*');
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeTruthy();
    // storing user contex
    await page.context().storageState({ path: authFile });
  }
);

// DEV, UAT
setup(
  "[E2E-ARC-1] env Come Cittadino voglio autenticarmi nell' Area Riservata Cittadino per poter usufruire dei servizi offerti",
  async ({ page }) => {
    setup.skip(
      await skipAuth() ? true : process.env.BASE_URL?.includes('localhost') as boolean,
      'Non è necessario autenticarsi più volte, sopratutto durante le fasi di sviluppo e debug'
    );

    await commonStep(page);

    await page.waitForURL('**/pagamenti/');
    await expect(page.getByLabel('app.dashboard.greeting')).toBeVisible();
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeTruthy();
    // storing user contex
    await page.context().storageState({ path: authFile });
  }
);
