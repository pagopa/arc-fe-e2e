import { test, expect } from '@playwright/test';
import { getFulfilledResponse } from '../utils';

test("[E2E-ARC-2] Come Cittadino autenticato voglio accedere alla sezione 'I miei dati' per poter consultare le informazioni del mio account SPID", async ({
  page
}) => {
  await page.goto('/pagamenti/');
  await expect(page).toHaveURL('/pagamenti/');

  const user: {
    userId: string;
    fiscalCode: string;
    familyName: string;
    name: string;
    email: string;
  } = await getFulfilledResponse(page, '/user');

  await page.getByRole('button').getByText(`${user.name} ${user.familyName}`).click();
  await page.getByText('I tuoi dati').click();

  page.waitForURL('**/profilo');

  await expect(page.getByTestId('app.user.title')).toBeVisible();
  await expect(page.getByTestId('app.user.info.name.value')).toContainText(user.name);
  await expect(page.getByTestId('app.user.info.surname.value')).toContainText(user.familyName);

  await expect(page.getByTestId('app.user.info.identifier.value')).toContainText(user.fiscalCode);
  await expect(page.getByTestId('app.user.info.email.value')).toContainText(user.email);
});

test("[E2E-ARC-3] Come Cittadino voglio 'sloggarmi' dall'applicativo", async ({ page }) => {
  // mock BE response to avoid accessToken cancel
  await page.route('*/**/arc/v1/logout', async (route) => {
    const json = {};
    await route.fulfill({ json });
  });

  await page.goto('/pagamenti/');
  await expect(page).toHaveURL('/pagamenti/');
  await expect(page.getByLabel('party-menu-button')).toBeVisible();
  await page.getByLabel('party-menu-button').click();
  await page.getByRole('menuitem').getByText('Esci').click();
  // wait for OI
  await expect(page).toHaveURL(new RegExp('oneid.pagopa.it/'));

  const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
  expect(accessToken).toBeNull();
});
