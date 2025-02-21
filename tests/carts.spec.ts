import { test, expect, Page } from '@playwright/test';
import { amountToEur } from '../utils/index';

let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test(`[E2E-ARC-12] Come Cittadino autenticato voglio poter inserire più avvisi di pagamento nel carrello in modo da poter effettuare un solo pagamento e risparmiare sui costi di commissione`, async () => {
  await page.goto(`/pagamenti/`);
  // setting this item to avoid the optin modal
  await page.evaluate(() => {
    window.sessionStorage.setItem('OPTIN', 'true');
  });
  await page.goto(`/pagamenti/avvisi/`);
  await expect(page).toHaveURL(`/pagamenti/avvisi/`);

  // waiting for the /payment-notices response
  const responsePromise = page.waitForResponse('**/arc/v1/payment-notices');
  const response = await responsePromise.then((response) => response.json());

  // wait for the list of payment notices
  await expect(page.locator('#payment-notices-list')).toBeVisible({ timeout: 10000 });
  const optionsListItemsCount = await page.getByTestId('payment-notices-item').count();
  // this test should have at least 2 items
  expect(optionsListItemsCount).toBeGreaterThan(1);

  // select the first item of the list showed
  const selectedItem = response['paymentNotices'][0];
  const listFirstItem = page.getByTestId('payment-notices-item').first();
  const firstItemAmount = selectedItem.paymentOptions[0].amount;
  // click on first item to go to the detail page
  await listFirstItem.getByTestId('payment-notices-item-cta').click();
  await expect(page).toHaveURL(`/pagamenti/avvisi/${selectedItem.iupd}/${selectedItem.paTaxCode}`);

  // toggle add/remove button
  const cartButton = page.locator('#payment-notice-add-button');
  const headerCartAmount = page.locator('#header-cart-amount');

  await expect(headerCartAmount).toHaveText(amountToEur(0));

  // add element to cart
  await cartButton.click();
  await expect(headerCartAmount).toHaveText(amountToEur(firstItemAmount));

  // close the drawer
  await page.getByTestId('CloseIcon').click();

  // remove the item
  await cartButton.click();
  await expect(headerCartAmount).toHaveText(amountToEur(0));

  // add the item again to continue with the test
  await cartButton.click();
  // close the drawer again
  await page.getByTestId('CloseIcon').click();

  // second item
  await page.goto(`/pagamenti/avvisi/`);
  await expect(page).toHaveURL(`/pagamenti/avvisi/`);

  // wait for the list of payment notices again
  await expect(page.locator('#payment-notices-list')).toBeVisible({ timeout: 10000 });

  // select the second item of the list showed
  const selectedSecondItem = response['paymentNotices'][1];
  const listSecondItem = page.getByTestId('payment-notices-item').nth(1);
  const secondItemAmount = selectedSecondItem.paymentOptions[0].amount;
  const totalAmountInEur = amountToEur(firstItemAmount + secondItemAmount);
  await listSecondItem.getByTestId('payment-notices-item-cta').click();

  await expect(page).toHaveURL(
    `/pagamenti/avvisi/${selectedSecondItem.iupd}/${selectedSecondItem.paTaxCode}`
  );

  // add second element to cart
  await cartButton.click();

  await expect(headerCartAmount).toHaveText(totalAmountInEur);

  // payment button click
  await page.locator('#pay-button').click();

  // wait for checkout
  await expect(page).toHaveURL(new RegExp('checkout.pagopa.it/'));
  // test if the car button as the same amount of the payment notice
  await expect(page.getByRole('button').getByText(totalAmountInEur)).toBeVisible({
    timeout: 10000
  });
});

test(`[E2E-ARC-12B] Come Cittadino autenticato voglio poter inserire più avvisi di pagamento nel carrello in modo da poter effettuare un solo pagamento e risparmiare sui costi di commissione ma si verifica un errore`, async () => {
  // 423(avvio-pagamento) error
  await page.goBack();
  page.route(
    '**/checkout/ec/v1/carts',
    async (route) => {
      await route.abort();
    },
    { times: 1 }
  );
  const headerCartAmount = page.locator('#header-cart-amount');
  headerCartAmount.click();
  const drawerCartAmount = page.locator('#drawer-cart-amount');
  await expect(drawerCartAmount).not.toHaveText(amountToEur(0));
  await page.locator('#pay-button').click();
  await expect(page).toHaveURL('/pagamenti/errore/avvio-pagamento');

  // 422(avviso-non-pagabile) error
  await page.goBack();
  headerCartAmount.click();
  page.route('**/checkout/ec/v1/carts', async (route) => {
    await route.fulfill({
      json: {
        title: 'Invalid payment info',
        status: 422,
        detail: 'Invalid payment notice data'
      },
      status: 422
    });
  });
  await page.locator('#pay-button').click();
  await expect(page).toHaveURL('/pagamenti/errore/avviso-non-pagabile');
});
