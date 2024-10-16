import { test, expect, Page } from '@playwright/test';
import { getFulfilledResponse, isValidDate } from '../utils';

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

let eventId;

test('[E2E-ARC-9] Come Cittadino voglio accedere alla pagina di dettaglio di una ricevuta in modo da poter consultare tutte le informazioni disponibili', async () => {
  await page.goto('/pagamenti/');
  await expect(page).toHaveURL('/pagamenti/');

  // waiting for the API call
  const listResponseBody = await getFulfilledResponse(page, 'arc/v1/notices');

  // saving info of the first item
  const listItem = listResponseBody.notices[0];

  eventId = listItem.eventId;

  // click on first row item
  page.locator("table[aria-label='Storico table'] > tbody > tr").nth(0).click();
  await expect(page).toHaveURL(`/pagamenti/transactions/${eventId}`);

  // waiting for the API call
  const { infoTransaction: transaction, carts } = await getFulfilledResponse(
    page,
    `arc/v1/transactions/${eventId}`
  );

  // DATA CHECKS
  expect(listItem.eventId === transaction.transactionId).toBeTruthy();
  expect(listItem.amount === transaction.amount).toBeTruthy();
  expect(listItem.noticeDate === transaction.transactionDate).toBeTruthy();
  // assuming a single cart item, needs an update when we will manage multi carts item
  expect(listItem.payeeName === carts[0].payee.name).toBeTruthy();
  // payee Name
  await expect(page.getByText(carts[0].payee.name)).toBeVisible();
  // payee taxt code
  await expect(page.getByText(carts[0].payee.taxCode)).toBeVisible();
  // recepit code
  await expect(page.getByText(carts[0].refNumberValue)).toBeVisible();
  // fee
  expect(typeof transaction.fee === 'number').toBeTruthy();
  // partial
  expect(typeof transaction.amount === 'number').toBeTruthy();
  // date
  expect(isValidDate(transaction.transactionDate)).toBeTruthy();
  // psp name
  await expect(page.getByText(transaction.pspName, { exact: true })).toBeVisible();
  // rrn
  await expect(page.getByText(transaction.rrn)).toBeVisible();
  // transactionId
  const transactionIdSubstring = transaction.transactionId.substring(0, 7);
  await expect(page.getByText(new RegExp(`${transactionIdSubstring}`))).toBeVisible();
});

test('[E2E-ARC-10] Come Cittadino voglio poter visualizzare il PDF di un avviso per poterlo stampare (eventualmente)', async ({
  browserName
}) => {
  // Unfortunately with chromium this assertion doesn't work. I think it's a kind of bug
  // https://github.com/microsoft/playwright/issues/6342
  test.skip(browserName === 'chromium');
  const pagePromise = page.waitForEvent('popup');
  await page.getByTestId('receipt-download-btn').click();
  const newPage = await pagePromise;
  await expect(newPage).toHaveURL(
    /blob:http(s)?:\/\/(dev.|uat.)?cittadini.pagopa.it\/([a-z]|[0-9]|-)*/
  );
});

test('[E2E-ARC-10B] Come Cittadino voglio poter visualizzare il PDF di un avviso per poterlo stampare (eventualmente), ma si verifica un errore.', async () => {
  await page.route('*/**/arc/v1/transactions/**/receipt*', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json'
    });
  });
  await page.getByTestId('receipt-download-btn').click();

  await expect(page.getByRole('alert')).toBeVisible();
});

test('[E2E-ARC-9B] Come Cittadino voglio accedere alla pagina di dettaglio di una ricevuta in modo da poter consultare tutte le informazioni disponibili, ma si verifica un errore.', async () => {
  await page.route('*/**/arc/v1/transactions/*', (route) => {
    route.abort();
  });
  const errorMessage = 'Ops! Something went wrong, please try again';
  await page.reload();
  await expect(page).toHaveURL(`/pagamenti/transactions/${eventId}`);
  await expect(page.getByText(errorMessage)).toBeVisible({ timeout: 20000 });
});

test(`[E2E-ARC-5C] Come Cittadino voglio accedere alla lista degli avvisi da pagare in modo da poter avere una visione sintetica e d’insieme, non ottengo alcun errore, ma non ho avvisi associati.`, async () => {
  const errorMessage = 'Qui vedrai le tue ricevute pagoPA';
  await page.route('**/arc/v1/notices*', async (route) => {
    const json = { notices: [] };
    await route.fulfill({ json });
  });

  await page.goto('/pagamenti/transactions');
  await expect(page).toHaveURL('/pagamenti/transactions');
  await expect(page.getByText(errorMessage)).toBeVisible();
});
