import { expect, Page } from '@playwright/test';

// TYPES AND INTERFACES
export interface Municipality {
  label: string;
  value: string;
}

export interface MunicipalityResponse {
  result: Municipality[];
}

export interface Reason {
  description: string;
  code: number;
}

export type ReasonResponse = Reason[];

export interface PaymentDetails {
  amount: string;
  ec: string;
  orgFiscalCode: string;
  nav: string;
  description?: string;
  debtPositionId?: string;
}

// CONSTANTS
export const userData = {
  name: 'Marco Polo',
  fiscal_code: 'PLOMRC01P30L736Y',
  email: 'marcopolo@test.it'
};

export const ARPU_BROKER_URL = '/cittadini/ptdemo';

export const TEST_PAID_IUV = '350000000001168214';

// SELECTORS
export const SELECTORS = {
  buttons: {
    next: 'spontanei-controls-continue-button',
    back: 'spontanei-controls-back-button',
    org: '[name="org"]',
    pay: 'pay-button',
    downloadNotice: 'download-notice-button',
    retry: 'courtesyPage.cta',
    login: 'loginPage-cta3',
    spontaneousPayment: 'loginPage-cta1'
  },
  inputs: {
    fullName: '[id="fullName"]',
    fiscalCode: '[id="fiscalCode"]',
    email: '[id="email"]',
    orgFiscalCode: '[id="orgFiscalCode"]',
    amount: '[name="amount"]',
    description: '[name="description"]'
  },
  helpers: {
    fullName: '[id="fullName-helper-text"]',
    fiscalCode: '[id="fiscalCode-helper-text"]',
    email: '[id="email-helper-text"]',
    orgFiscalCode: '[id="orgFiscalCode-helper-text"]'
  },
  summary: {
    municipality: 'summary-extra-orgFiscalCode.label-value',
    municipalityCode: 'summary-extra-orgFiscalCode.value-value',
    debtType: 'summary-extra-debtType.description-value',
    amount: 'summary-extra-cieAmountCents-value',
    debtorName: 'summary-debtor-name-value',
    debtorCode: 'summary-debtor-code-value',
    debtorEmail: 'summary-debtor-email-value'
  },
  noticeSearch: {
    iuvInput: '[id="iuvOrNav"]',
    cfInput: '[id="fiscalCode"]',
    searchButton: 'button[type="submit"]',
    downloadButton: 'download-payment-notice-button',
    statusClass: '.status__UNPAID',
    payButtonLabel: 'pay-now-button'
  },
  sidebar: {
    home: 'sidebar-menu-item-homepage',
    debtPositions: 'sidebar-menu-item-debt-positions',
    receipts: 'sidebar-menu-item-receipts'
  },
  debtPositionListPage: {
    detailButton: 'debt-position-detail-button-:debtPositionId'
  },
  receiptListPage: {
    detailButton: 'receipt-detail-button-:receiptId'
  },
  receiptDetailPage: {
    downloadButton: 'receipt-detail-download-button'
  },
  debtPositionDetailPage: {
    payButton: 'payment-option-action-pay'
  },
  searchPage: {
    goToDetailButton: 'search-item-detail-button'
  },
  listItem: {
    ec: 'list-item-ec',
    description: 'list-item-description'
  }
};

// HELPERS
/** Return a random element from a list */
export function getRandomFrom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Convers a currency string to a number.
 * Example: '12,21 €' -> 12.21
 */
export function parseCurrencyToNumber(currencyString: string): number {
  if (!currencyString) return 0;
  // Remove non-numeric characters except for the decimal separator (comma)
  // This assumes the Italian/European format provided in the example
  const sanitized = currencyString.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(sanitized);
}
/**
 * Simulates the checkout payment process for a given notice.
 */
export const simulateCheckoutPayment = async (page: Page, paymentDetails: PaymentDetails) => {
  await page.getByLabel('Apri riepilogo pagamento').click();

  const amount = page
    .getByText('Importo', { exact: true })
    .locator('xpath=following-sibling::*[1]');
  await expect(amount).toHaveText(paymentDetails.amount);

  const ec = page
    .getByText('Ente Creditore', { exact: true })
    .locator('xpath=following-sibling::*[1]');
  await expect(ec).toHaveText(paymentDetails.ec);

  //Simulate successful completion
  await page.goto(
    `${ARPU_BROKER_URL}/public/esito/pagamento-avviso-completato?nav=${paymentDetails.nav}&org_fiscal_code=${paymentDetails.orgFiscalCode}`
  );
  await page.waitForURL(
    `${ARPU_BROKER_URL}/public/esito/pagamento-avviso-completato?nav=${paymentDetails.nav}&org_fiscal_code=${paymentDetails.orgFiscalCode}`
  );
};

/**
 * Finds a debt position by its description using pagination.
 */
export const findDebPositionByDescriptionUsingPagination = async (
  page: Page,
  description: string
) => {
  let found = false;
  let currentPage = 1;
  while (!found && currentPage <= 20) {
    const notices = page.locator('[role="listitem"]');
    await expect(notices.first()).toBeVisible();
    const count = await notices.count();
    console.log(
      `Checking ${count} debt positions on page ${currentPage} for description: "${description}"`
    );

    for (let i = 0; i < count; i++) {
      const noticeDescription = await notices
        .nth(i)
        .getByTestId(SELECTORS.listItem.description)
        .textContent();
      if (noticeDescription === description) {
        found = true;
        break;
      }
    }

    if (!found) {
      const nextButton = page.getByLabel('Go to next page');
      if (!(await nextButton.isVisible())) {
        break; // No more pages to navigate
      }
      await nextButton.click();
      currentPage++;
    }
  }

  return found;
};
