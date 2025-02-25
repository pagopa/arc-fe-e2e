import { test, expect, Page } from '@playwright/test';
import { amountToEur } from '../utils/index';

let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});
test.afterAll(async () => {
  await page.close();
});

test("[E2E-ARC-4] Come Cittadino autenticato voglio cliccare sul pulsante 'Paga un avviso' in modo da pagare l'avviso con checkout", async ({
  page
}) => {
  await page.goto('/pagamenti/');
  await expect(page).toHaveURL('/pagamenti/');
  await page.getByRole('link', { name: 'Paga un avviso' }).click();
  const newTabPromise = page.waitForEvent('popup');

  const newTab = await newTabPromise;
  await newTab.waitForLoadState();

  await expect(newTab).toHaveURL(new RegExp('checkout.pagopa.it/'));
});

test(`Avvisi e pagamento`, async () => {
  const selectedItem =
    await test.step(`[E2E-ARC-5] Come Cittadino voglio accedere alla lista degli avvisi da pagare`, async () => {
      await page.goto('/pagamenti/avvisi/');
      await expect(page).toHaveURL('/pagamenti/avvisi/');
      await expect(page.locator('#searchButtonPaymentNotices')).toBeVisible();
      await page.locator('#searchButtonPaymentNotices').click();

      const responsePromise = page.waitForResponse('**/arc/v1/payment-notices');

      // wait for modal and click on the cta button
      await expect(page.locator('#pull-payments-modal .MuiPaper-root')).toBeVisible();
      await page.locator('#pull-payments-modal-ok').click();
      const response = await responsePromise.then((response) => response.json());

      // test if session storage var is filled
      const OPTIN = await page.evaluate(() => sessionStorage.getItem('OPTIN'));
      expect(OPTIN).toBeTruthy();
      // wait for the list of payment notices
      await expect(page.locator('#payment-notices-list')).toBeVisible({ timeout: 10000 });
      const optionsListItemsCount = await page.getByTestId('payment-notices-item').count();
      expect(optionsListItemsCount).toBeGreaterThan(0);

      const selectedItem = response['paymentNotices'][0];
      // select the first item of the list showed
      const listFirstItem = page.getByTestId('payment-notices-item').first();

      // DATA CHECKS
      await expect(listFirstItem.locator('h1')).toBeVisible();
      await expect(listFirstItem.locator('h2')).toBeVisible();
      await expect(listFirstItem.getByTestId('payment-notices-item-cta')).toBeVisible();
      await listFirstItem.getByTestId('payment-notices-item-cta').click();
      await expect(page).toHaveURL(
        `/pagamenti/avvisi/${selectedItem.iupd}/${selectedItem.paTaxCode}`
      );
      return selectedItem;
    });

  const selectedItemDetail =
    await test.step(`[E2E-ARC-6] Come Cittadino voglio accedere al dettaglio di un avviso di pagamento`, async () => {
      const response = await page.waitForResponse((response) =>
        response.url().includes(selectedItem.iupd)
      );
      const selectedItemDetail = await response.json();

      const amount = selectedItemDetail.paymentOptions[0].amount;
      const amountInEur = amountToEur(amount);

      expect(selectedItemDetail.paymentOptions[0].iuv).toBe(
        selectedItem.paymentOptions[0].installments[0].iuv
      );

      await expect(page.getByTestId('app.paymentNoticeDetail.amount').locator('dd')).toHaveText(
        amountInEur
      );
      await expect(page.getByTestId('app.paymentNoticeDetail.paFullname').locator('dd')).toHaveText(
        selectedItemDetail.paFullName
      );
      await expect(page.getByTestId('app.paymentNoticeDetail.paTaxCode').locator('dd')).toHaveText(
        selectedItemDetail.paTaxCode
      );
      await expect(page.getByTestId('app.paymentNoticeDetail.subject').locator('dd')).toHaveText(
        selectedItemDetail.paymentOptions[0].description
      );
      await expect(page.getByTestId('app.paymentNoticeDetail.iuv').locator('dd')).toHaveText(
        selectedItemDetail.paymentOptions[0].iuv
      );

      await expect(page.locator('#payment-notice-add-button')).toBeEnabled();

      return selectedItemDetail;
    });

  await test.step(`[E2E-ARC-7] Come Cittadino voglio poter avviare il pagamento di un avviso`, async () => {
    const amount = selectedItemDetail.paymentOptions[0].amount;

    const amountInEur = amountToEur(amount);

    // click to add to the cart
    await page.locator('#payment-notice-add-button').click();
    // click to pay
    await page.locator('#pay-button').click();
    // wait for checkout
    await expect(page).toHaveURL(new RegExp('checkout.pagopa.it/'));
    // test on checkout side
    await expect(page.locator('#email')).toBeVisible({ timeout: 10000 });
    // test if the car button as the same amount of the payment notice
    await expect(page.getByRole('button').getByText(amountInEur)).toBeVisible();
  });
});

test(`[E2E-ARC-5B] Come Cittadino voglio accedere alla lista degli avvisi da pagare, ma si verifca un errore`, async () => {
  // causing a error when requesting payment notices items
  await page.route('**/arc/v1/payment-notices', (route) => route.abort());

  await page.goto('/pagamenti/avvisi/');
  await expect(page).toHaveURL('/pagamenti/avvisi/');

  // close the drawer
  await page.getByTestId('CloseIcon').click();

  // test if session storage var is filled
  const OPTIN = await page.evaluate(() => sessionStorage.getItem('OPTIN'));
  expect(OPTIN).toBeTruthy();

  // timeout extending, waiting for retries ending on routes abort
  await expect(page.getByTestId('app.paymentNotice.error.description')).toBeVisible({
    timeout: 1000 * 10
  });

  // clearing abort
  await page.unroute('**/arc/v1/payment-notices');
  await page.getByTestId('app.paymentNotice.error.button').click();

  // wait for the list of payment notices assuming that by now the API works
  // timeout extended to wait for the fake loading
  await expect(page.locator('#payment-notices-list')).toBeVisible({
    timeout: 1000 * 10
  });
  const optionsListItemsCount = await page.getByTestId('payment-notices-item').count();
  expect(optionsListItemsCount).toBeGreaterThan(0);
});

test(`[E2E-ARC-5C] Come Cittadino voglio accedere alla lista degli avvisi da pagare in modo da poter avere una visione sintetica e d’insieme, non ottengo alcun errore, ma non ho avvisi associati.`, async () => {
  // reset mock
  await page.unroute('**/arc/v1/payment-notices');
  // override response setting an empty array
  await page.route('**/arc/v1/payment-notices', async (route) => {
    const json = { paymentNotices: [] };
    await route.fulfill({ json });
  });
  // reload
  page.reload();
  // test
  await expect(page).toHaveURL('/pagamenti/avvisi/');
  await expect(page.getByTestId('app.paymentNotice.empty')).toBeVisible({ timeout: 10000 });
});
