import { cie as test, RANDOMNESS_CONFIG, paymentAmount } from './fixtures/cie.fixture.ts';
import { SELECTORS, userData } from '../../utils/index.ts';
import { expect } from '@playwright/test';

// Disable randomness
RANDOMNESS_CONFIG.enableStep2bNavigation = false;
RANDOMNESS_CONFIG.enableStep3bNavigation = false;

// ============================================================================
// TESTS - Payment Failure
// ============================================================================

test('CIE-006 - Come cittadino voglio pagare online per richiedere o rinnovare la Carta di Identità elettronica, ma il pagamento non va a buon fine', async ({
  CIE
}) => {
  await test.step('Proceed to payment checkout', async () => {
    await CIE.getByTestId(SELECTORS.buttons.pay).click();
    await CIE.waitForURL(/checkout\.pagopa\.it\//, { timeout: 15000 });
    await expect(CIE.getByLabel('Email')).toBeVisible();
  });

  await test.step('Cancel payment to simulate failure', async () => {
    await CIE.getByRole('button', { name: 'Indietro' }).click();
    await CIE.waitForURL(/esito\/pagamento-annullato/);

    // Wait for the cancel page to fully render and settle before navigating away
    await CIE.getByTestId('courtesyPage.title').waitFor({ state: 'visible' });
    await CIE.waitForLoadState('networkidle');
  });

  await test.step('Navigate to failure page', async () => {
    // Simulate navigation to payment failure page
    const failureUrl = CIE.url().replace('pagamento-annullato', 'pagamento-non-riuscito');
    await CIE.goto(failureUrl);

    // Verify failure page
    await expect(CIE).toHaveURL(/esito\/pagamento-non-riuscito/);
    await expect(CIE.getByTestId('courtesyPage.title')).toBeVisible();
    await expect(CIE.getByTestId('courtesyPage.cta')).toBeVisible();
  });
});

test('CIE-007 - Come cittadino voglio pagare online per richiedere o rinnovare la Carta di Identità elettronica, ma il pagamento non va a buon fine e decido di riprovare', async ({
  CIE
}) => {
  test.slow();

  await test.step('Step 1: Proceed to payment checkout', async () => {
    await CIE.getByTestId(SELECTORS.buttons.pay).click();
    await CIE.waitForURL(/checkout\.pagopa\.it\//, { timeout: 15000 });
    await expect(CIE.getByLabel('Email')).toBeVisible();
  });

  await test.step('Step 2: Cancel payment and simulate failure', async () => {
    await CIE.getByRole('button', { name: 'Indietro' }).click();
    await expect(CIE).toHaveURL(/esito\/pagamento-annullato/);
    await expect(CIE.getByTestId('courtesyPage.title')).toBeVisible();
    await CIE.waitForLoadState('networkidle');

    const failureUrl = CIE.url().replace('pagamento-annullato', 'pagamento-non-riuscito');
    await CIE.goto(failureUrl);

    await expect(CIE).toHaveURL(/esito\/pagamento-non-riuscito/);
    await expect(CIE.getByTestId(SELECTORS.buttons.retry)).toBeVisible();

    // give the page time to "settle" like a human would
    await CIE.waitForLoadState('networkidle');
    await CIE.waitForTimeout(2000);
  });

  await test.step('Step 3: Click "Riprova" and verify checkout redirect', async () => {
    await CIE.getByTestId(SELECTORS.buttons.retry).click();
    await CIE.waitForURL(/checkout\.pagopa\.it\//, { timeout: 15000 });
  });

  await test.step('Step 4: Complete payment on checkout', async () => {
    await expect(CIE.getByRole('button').filter({ hasText: paymentAmount })).toBeVisible();

    await expect(CIE.getByLabel('Email')).toHaveValue('');
    await CIE.getByLabel('Email').fill(userData.email);
    await CIE.getByLabel('Ripeti di nuovo').fill(userData.email);
    await CIE.getByRole('button', { name: 'Continua' }).click();

    await CIE.getByRole('button', { name: 'Carta di credito o debito' }).click();
  });

  await test.step('Step 5: Simulate successful payment completion', async () => {
    await CIE.goto('/cittadini/cie/public/esito/pagamento-avviso-completato');
    await expect(CIE).toHaveURL('/cittadini/cie/public/esito/pagamento-avviso-completato');
  });
});
