import { test, expect } from '@playwright/test';
import { test as authTest } from './fixtures/auth.fixture';
import {
  SELECTORS,
  ARPU_BROKER_URL,
  TEST_PAID_IUV,
  PaymentDetails,
  findDebPositionByDescriptionUsingPagination,
  simulateCheckoutPayment,
  userData
} from '../../utils';
import { NOTICE_API } from '../../utils/api';

const TEST_URL = ARPU_BROKER_URL;

authTest(
  'ARPU-001 - Come cittadino voglio pagare un avviso di pagamento',
  async ({ authenticatedPage }) => {
    const debtPositionInfo = {
      ec: 'EC DEMO',
      description: '[TEST E2E - DO NOT DELETE] Tipo dovuto di test',
      amount: '97,50 €',
      orgFiscalCode: '99999000013',
      nav: '350000000001140314',
      debtPositionId: '528854'
    };

    await authenticatedPage.goto(`${TEST_URL}`);
    await authenticatedPage.getByTestId(SELECTORS.sidebar.debtPositions).click();

    const result = await findDebPositionByDescriptionUsingPagination(
      authenticatedPage,
      debtPositionInfo.description
    );
    expect(result).toBe(true);

    if (!result) {
      throw new Error(
        `Notice with the specified description "${debtPositionInfo.description}" not found.`
      );
    }

    await authenticatedPage
      .getByTestId(
        SELECTORS.debtPositionListPage.detailButton.replace(
          ':debtPositionId',
          debtPositionInfo.debtPositionId!
        )
      )
      .click();

    await authenticatedPage.getByTestId(SELECTORS.debtPositionDetailPage.payButton).click();

    //CHECKOUT
    await simulateCheckoutPayment(authenticatedPage, debtPositionInfo);
  }
);

authTest(
  'ARPU-002 - Come cittadino voglio scaricare una ricevuta di pagamento dalla lista ricevute',
  async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`${TEST_URL}`);
    await authenticatedPage.getByTestId(SELECTORS.sidebar.receipts).click();

    expect(authenticatedPage.url()).toContain(`${TEST_URL}/ricevute`);

    const content = authenticatedPage.getByRole('main');
    const firstReceipt = content.getByRole('listitem').first();
    const orgName = await firstReceipt.getByTestId(SELECTORS.listItem.ec).textContent();
    const description = await firstReceipt
      .getByTestId(SELECTORS.listItem.description)
      .textContent();

    const receiptDetailButtonRegex = new RegExp(
      `${SELECTORS.receiptListPage.detailButton.replace(':receiptId', '\\d+')}$`,
      'i'
    );

    await firstReceipt.getByTestId(receiptDetailButtonRegex).click();

    await expect(authenticatedPage.getByText(orgName!)).toBeVisible();
    await expect(authenticatedPage.getByText(description!)).toBeVisible();

    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.getByTestId(SELECTORS.receiptDetailPage.downloadButton).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('.pdf');
  }
);

test('ARPU-004 - Come cittadino voglio generare un avviso di pagamento “spontaneo" e procedere con il pagamento', async ({
  page
}) => {
  const TEST_OBJECT = 'ARPU-004 Causale di test';
  const TEST_REASON = '[E2E DO NOT DELETE]';
  const TEST_AMOUNT_FORMATED = '2,00 €';
  const TEST_AMOUNT_VALUE = '2';
  const noticeInfo = {
    ec: 'EC DEMO',
    orgFiscalCode: '99999000013'
  };

  await page.goto(`${TEST_URL}/accesso`);
  await page.getByTestId(SELECTORS.buttons.spontaneousPayment).click();

  // Select Municipality
  await page.locator(SELECTORS.buttons.org).click();
  await page.getByRole('option', { name: noticeInfo.ec }).click();
  await page.getByTestId(SELECTORS.buttons.next).click();

  // Select Reason
  await page.getByText(TEST_REASON).click();
  await page.getByTestId(SELECTORS.buttons.next).click();

  // Fill Form
  await page.locator(SELECTORS.inputs.fullName).click();
  await page.locator(SELECTORS.inputs.fullName).fill(userData.name);
  await page.locator(SELECTORS.inputs.email).click();
  await page.locator(SELECTORS.inputs.email).fill(userData.email);
  await page.locator(SELECTORS.inputs.description).click();
  await page.locator(SELECTORS.inputs.description).fill(TEST_OBJECT);
  await page.locator(SELECTORS.inputs.fiscalCode).click();
  await page.locator(SELECTORS.inputs.fiscalCode).fill(userData.fiscal_code);
  await page.locator(SELECTORS.inputs.amount).click();
  await page.locator(SELECTORS.inputs.amount).fill(TEST_AMOUNT_VALUE);
  await page.getByTestId(SELECTORS.buttons.next).click();

  // Resume
  await expect(page.getByTestId('summary-org-name-value')).toContainText(noticeInfo.ec);
  await expect(page.getByTestId('summary-payment-amount-value')).toContainText(
    TEST_AMOUNT_FORMATED
  );
  await expect(page.getByTestId('summary-org-code-value')).toContainText(noticeInfo.orgFiscalCode);
  await expect(page.getByTestId('summary-service-name-value')).toContainText(TEST_REASON);
  await expect(page.getByTestId('summary-debtor-name-value')).toContainText(userData.name);
  await expect(page.getByTestId('summary-debtor-code-value')).toContainText(userData.fiscal_code);
  await expect(page.getByTestId('summary-debtor-email-value')).toContainText(userData.email);
  await expect(page.getByTestId('summary-payment-description-value')).toContainText(TEST_OBJECT);

  await page.getByTestId(SELECTORS.buttons.next).click();

  //download notice pd
  const noticeResponsePromise = page.waitForResponse(NOTICE_API);
  const noticeResponse = await noticeResponsePromise;
  const noticeResponseData = await noticeResponse.json();
  const { nav } = noticeResponseData.paymentDetails;

  //Wait for DB update notice status
  await page.waitForTimeout(2000);
  const newPagePromise = page.waitForEvent('popup');
  await page.getByTestId(SELECTORS.buttons.downloadNotice).click();

  const newPage = await newPagePromise;
  await newPage.waitForLoadState();

  // Wait for download to start in the new tab
  const download = await newPage.waitForEvent('download');
  expect(download.suggestedFilename()).toContain('.pdf');

  // Pay notice
  await page.getByTestId(SELECTORS.buttons.pay).click();

  //CHECKOUT
  await simulateCheckoutPayment(page, {
    amount: TEST_AMOUNT_FORMATED,
    ec: noticeInfo.ec,
    orgFiscalCode: noticeInfo.orgFiscalCode,
    nav: nav
  });
});

test('ARPU-005 - Come cittadino voglio recuperare una ricevuta di un pagamento che ho effettuato per poter consultare il dettaglio e scaricare il pdf', async ({
  page
}) => {
  const receiptInfo = {
    amount: '3,00 €',
    noticeCode: '50000000001168214',
    ec: 'EC DEMO'
  };

  await page.goto(
    `${TEST_URL}/public/ricevute/ricerca#fiscalCode=${userData.fiscal_code}&iuvOrNav=${TEST_PAID_IUV}`
  );

  await expect(page.getByText(receiptInfo.amount)).toBeVisible();
  await expect(page.getByText(receiptInfo.noticeCode)).toBeVisible();
  await expect(page.getByText(receiptInfo.ec)).toBeVisible();

  await page.getByTestId(SELECTORS.searchPage.goToDetailButton).click();

  await expect(page.getByText(receiptInfo.amount)).toBeVisible();
  await expect(page.getByText(receiptInfo.noticeCode)).toBeVisible();
  await expect(page.getByText(receiptInfo.ec)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId(SELECTORS.receiptDetailPage.downloadButton).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toContain('.pdf');
});

test('ARPU-006 - Come cittadino voglio cercare una avviso di pagamento, scaricare il pdf e procedere con il pagamento', async ({
  page
}) => {
  const noticeInfo: PaymentDetails = {
    ec: 'EC DEMO',
    description: '[TEST E2E - DO NOT DELETE] Tipo dovuto di test',
    amount: '97,50 €',
    orgFiscalCode: '99999000013',
    nav: '350000000001140314',
    debtPositionId: '528854'
  };

  await page.goto(`${TEST_URL}/accesso`);
  await page.getByTestId(SELECTORS.buttons.login).click();

  // form compilation
  await page.locator(SELECTORS.noticeSearch.iuvInput).fill(noticeInfo.nav);
  await page.locator(SELECTORS.noticeSearch.cfInput).fill(userData.fiscal_code);
  await page.locator(SELECTORS.noticeSearch.searchButton).click();

  //download notice pdf
  await expect(page.locator(SELECTORS.noticeSearch.statusClass)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId(SELECTORS.noticeSearch.downloadButton).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toContain('.pdf');

  //pay notice
  await page.goBack();
  await page.getByTestId(SELECTORS.noticeSearch.payButtonLabel).click();

  //CHECKOUT
  await simulateCheckoutPayment(page, noticeInfo);
});
