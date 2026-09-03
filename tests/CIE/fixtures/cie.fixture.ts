import { test as base, expect } from '@playwright/test';
import {
  userData,
  getRandomFrom,
  parseCurrencyToNumber,
  type Reason,
  type Municipality,
  type ReasonResponse,
  type MunicipalityResponse,
  SELECTORS
} from '../../../utils';
import { MUNICIPALITIES_API, REASONS_API } from '../../../utils/api.ts';

const TEST_URL = '/cittadini/cie/public/spontanei/';
const MIN_AMOUNT = 1;

// Exported state for tests to access
export let reason: Reason;
export let municipality: Municipality;
export let paymentAmount: string;

/**
 * Randomness configuration
 * Set to false to disable random back navigation for deterministic tests
 */
export const RANDOMNESS_CONFIG = {
  enableStep2bNavigation: true, // Allow user to change reason and municipality
  enableStep3bNavigation: true, // Allow user to return to form
  randomChance: 0.5 // 50% chance for each random step (0-1)
};

/**
 * Check if a random event should occur
 * Can be overridden per test by setting RANDOMNESS_CONFIG properties
 */
function shouldExecuteRandomStep(enableRandomness: boolean): boolean {
  if (!enableRandomness) return false;
  return Math.random() > RANDOMNESS_CONFIG.randomChance;
}

/**
 * Base CIE Fixture
 *
 * Provides a complete flow from reason selection to payment page
 * Steps 1-4: Reason → Form (with optional back) → Summary (with optional back) → Payment
 *
 * The fixture includes optional random navigation steps that can be:
 * - Disabled globally via RANDOMNESS_CONFIG
 * - Overridden per test by modifying RANDOMNESS_CONFIG before using the fixture
 */
export const cie = base.extend({
  CIE: async ({ page }, use) => {
    let avaiableReasons: ReasonResponse;
    let avaiableMunicipalities: MunicipalityResponse;
    const reasonsResponsePromise = page.waitForResponse(REASONS_API);
    const municipalityResponse = page.waitForResponse(MUNICIPALITIES_API);

    await page.goto(TEST_URL);

    // STEP 1: REASON PAGE
    await base.step('Step 1: Select reason', async () => {
      avaiableReasons = await (await reasonsResponsePromise).json();
      reason = getRandomFrom(avaiableReasons);
      await page.getByText(reason.description).click();
    });

    await page.getByTestId(SELECTORS.buttons.next).click();

    // STEP 2: FORM PAGE
    await base.step('Step 2: Fill form and check validation', async () => {
      avaiableMunicipalities = await (await municipalityResponse).json();
      municipality = getRandomFrom(avaiableMunicipalities.result);
      const amountResponsePromise = page.waitForResponse(
        `**/pu/cie/public/organizations/${municipality.value}/amount?debtPositionTypeOrgCode=${reason.code}`
      );

      // Test validation errors on empty form
      await page.getByTestId(SELECTORS.buttons.next).click();

      await expect(page.locator(SELECTORS.helpers.fullName)).toBeVisible();
      await expect(page.locator(SELECTORS.helpers.email)).toBeVisible();
      await expect(page.locator(SELECTORS.helpers.fiscalCode)).toBeVisible();
      await expect(page.locator(SELECTORS.helpers.orgFiscalCode)).toBeVisible();

      // Select random municipality
      await page.locator(SELECTORS.inputs.orgFiscalCode).click();
      await page.getByRole('option', { name: municipality.label }).click();
      await amountResponsePromise;

      // Fill debtor data
      await page.locator(SELECTORS.inputs.fullName).fill(userData.name);
      await page.locator(SELECTORS.inputs.fiscalCode).fill(userData.fiscal_code);
      await page.locator(SELECTORS.inputs.email).fill(userData.email);

      // Verify errors cleared
      await expect(page.locator(SELECTORS.helpers.fullName)).not.toBeVisible();
      await expect(page.locator(SELECTORS.helpers.email)).not.toBeVisible();
      await expect(page.locator(SELECTORS.helpers.fiscalCode)).not.toBeVisible();
      await expect(page.locator(SELECTORS.helpers.orgFiscalCode)).not.toBeVisible();
    });

    // STEP 2B (OPTIONAL - can be disabled via RANDOMNESS_CONFIG)
    if (shouldExecuteRandomStep(RANDOMNESS_CONFIG.enableStep2bNavigation)) {
      await base.step('Step 2B: User reconsiders and changes reason', async () => {
        await page.getByTestId(SELECTORS.buttons.back).click();
        await expect(page.getByLabel(reason.description)).toBeChecked();

        municipality = getRandomFrom(avaiableMunicipalities.result);
        reason = getRandomFrom(avaiableReasons);
        const amountResponsePromise = page.waitForResponse(
          `**/pu/cie/public/organizations/${municipality.value}/amount?debtPositionTypeOrgCode=${reason.code}`
        );

        await page.getByText(reason.description).click();
        await page.getByTestId(SELECTORS.buttons.next).click();

        // Verify form reset
        await expect(page.getByRole('combobox', { name: 'Cerca il comune' })).toBeEmpty();

        // Select new municipality
        await page.locator(SELECTORS.inputs.orgFiscalCode).click();
        await page.getByRole('option', { name: municipality.label }).click();
        await amountResponsePromise;
      });
    }

    await page.getByTestId(SELECTORS.buttons.next).click();

    // STEP 3: SUMMARY PAGE
    await base.step('Step 3: Review and verify summary', async () => {
      await expect(page.getByTestId(SELECTORS.summary.municipality)).toContainText(
        municipality.label
      );
      await expect(page.getByTestId(SELECTORS.summary.municipalityCode)).toContainText(
        municipality.value
      );
      await expect(page.getByTestId(SELECTORS.summary.debtType)).toContainText(reason.description);

      const amount = await page.getByTestId(SELECTORS.summary.amount).textContent();
      const parsedAmount = parseCurrencyToNumber(amount || '');
      expect(parsedAmount).toBeGreaterThan(MIN_AMOUNT);

      paymentAmount = new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(parsedAmount);

      await expect(page.getByTestId(SELECTORS.summary.debtorName)).toContainText(userData.name);
      await expect(page.getByTestId(SELECTORS.summary.debtorCode)).toContainText(
        userData.fiscal_code
      );
      await expect(page.getByTestId(SELECTORS.summary.debtorEmail)).toContainText(userData.email);
    });

    // STEP 3B (OPTIONAL - can be disabled via RANDOMNESS_CONFIG)
    if (shouldExecuteRandomStep(RANDOMNESS_CONFIG.enableStep3bNavigation)) {
      await base.step('Step 3B: User returns to form to verify data persists', async () => {
        await page.getByTestId(SELECTORS.buttons.back).click();

        await expect(page.locator(SELECTORS.inputs.fullName)).toHaveValue(userData.name);
        await expect(page.locator(SELECTORS.inputs.fiscalCode)).toHaveValue(userData.fiscal_code);
        await expect(page.locator(SELECTORS.inputs.email)).toHaveValue(userData.email);
        await expect(page.getByRole('combobox', { name: 'Cerca il comune' })).toHaveValue(
          municipality.label
        );

        await page.getByTestId(SELECTORS.buttons.next).click();

        // Verify summary again
        await expect(page.getByTestId(SELECTORS.summary.municipality)).toContainText(
          municipality.label
        );
        await expect(page.getByTestId(SELECTORS.summary.debtType)).toContainText(
          reason.description
        );
      });
    }

    await page.getByTestId(SELECTORS.buttons.next).click();

    // STEP 4: PAYMENT PAGE
    await base.step('Step 4: Process payment and verify payment page', async () => {
      const debtPositionResponse = page.waitForResponse(
        (r) => r.url().includes('spontaneous/debt-positions') && r.request().method() === 'POST'
      );
      const response = await debtPositionResponse;
      expect(response.ok()).toBeTruthy();
    });

    await use(page);
  }
});
