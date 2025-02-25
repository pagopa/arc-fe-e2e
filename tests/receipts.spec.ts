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
  const listResponseBody = await getFulfilledResponse(page, 'arc/v1/notices?');

  // saving info of the first item
  const listItem = listResponseBody.notices[0];

  eventId = listItem.eventId;

  // click on first row item
  page.getByTestId('transaction-details-button').first().click();
  await expect(page).toHaveURL(`/pagamenti/ricevute/${eventId}`);

  // waiting for the API call
  const { infoNotice: notice, carts } = await getFulfilledResponse(
    page,
    `arc/v1/notices/${eventId}`
  );

  // DATA CHECKS
  // expect(listItem.eventId === notice.eventId).toBeTruthy();
  expect(listItem.amount === notice.amount).toBeTruthy();
  expect(listItem.noticeDate === notice.noticeDate).toBeTruthy();
  // assuming a single cart item, needs an update when we will manage multi carts item
  expect(listItem.payeeName === carts[0].payee.name).toBeTruthy();
  // payee Name
  await expect(page.locator('#transaction-detail-creditorEntity')).toHaveText(carts[0].payee.name);
  // payee taxt code
  await expect(page.locator('#transaction-detail-creditorFiscalCode')).toHaveText(
    carts[0].payee.taxCode
  );
  // recepit code
  await expect(page.locator('#transaction-detail-noticeCode')).toBeVisible(carts[0].refNumberValue);
  // fee
  expect(typeof notice.fee === 'number').toBeTruthy();
  // partial
  expect(typeof notice.amount === 'number').toBeTruthy();
  // date
  expect(isValidDate(notice.noticeDate)).toBeTruthy();
  // psp name
  await expect(page.locator('#transaction-detail-psp')).toHaveText(notice.pspName);
  // eventId
  const eventIdSubstring =
    notice.eventId.length > 20 ? notice.eventId.substring(0, 20) + '…' : notice.eventId;
  await expect(page.locator('#transaction-detail-eventId')).toHaveText(eventIdSubstring);
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
    /blob:http(s)?:\/\/((dev.|uat.)?cittadini.pagopa.it|localhost:1234)\/([a-z]|[0-9]|-)*/
  );
});

test('[E2E-ARC-10B] Come Cittadino voglio poter visualizzare il PDF di un avviso per poterlo stampare (eventualmente), ma si verifica un errore.', async () => {
  await page.route('*/**/arc/v1/notices/**/receipt*', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json'
    });
  });
  await page.getByTestId('receipt-download-btn').click();

  await expect(page.getByRole('alert')).toBeVisible();
});

test('[E2E-ARC-9B] Come Cittadino voglio accedere alla pagina di dettaglio di una ricevuta in modo da poter consultare tutte le informazioni disponibili, ma si verifica un errore.', async () => {
  await page.route('*/**/arc/v1/notices/*', (route) => {
    route.abort();
  });
  await page.reload();
  await expect(page).toHaveURL(`/pagamenti/ricevute/${eventId}`);
  await expect(page.locator('#data-error')).toBeVisible({ timeout: 20000 });
});
