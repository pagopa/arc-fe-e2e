import {
  cie as test,
  RANDOMNESS_CONFIG,
  paymentAmount,
  municipality
} from './fixtures/cie.fixture.ts';
import { SELECTORS, userData } from '../../utils/index.ts';
import { expect } from '@playwright/test';

// Enable randomness
RANDOMNESS_CONFIG.enableStep2bNavigation = true;
RANDOMNESS_CONFIG.enableStep3bNavigation = true;

// ============================================================================
// TESTS - Happy Path
// ============================================================================

test('CIE-001 - Come cittadino voglio generare un avviso di pagamento per richiedere o rinnovare la Carta di Identità elettronica', async ({
  CIE
}) => {
  await expect(CIE.getByTestId(SELECTORS.buttons.pay)).toBeVisible();
  await expect(CIE.getByTestId(SELECTORS.buttons.downloadNotice)).toBeVisible();
});

test("CIE-002 - Come cittadino voglio scaricare il pdf dell'avviso generato per richiedere o rinnovare la Carta di Identità elettronica", async ({
  CIE
}) => {
  //Wait for DB update notice status
  await CIE.waitForTimeout(2000);

  const newPagePromise = CIE.waitForEvent('popup');
  await CIE.getByTestId(SELECTORS.buttons.downloadNotice).click();

  const newPage = await newPagePromise;
  await newPage.waitForLoadState();

  // Wait for download to start in the new tab
  const download = await newPage.waitForEvent('download');
  expect(download.suggestedFilename()).toContain('.pdf');
});

test('CIE-003 - Come cittadino voglio pagare online per richiedere o rinnovare la Carta di Identità elettronica', async ({
  CIE
}) => {
  await test.step('Proceed to checkout', async () => {
    await CIE.getByTestId(SELECTORS.buttons.pay).click();
    await CIE.waitForURL(/checkout\.pagopa\.it\//);
  });

  await test.step('Verify payment details at checkout', async () => {
    // Verify amount
    const paymentButton = CIE.getByRole('button').filter({ hasText: paymentAmount });
    await paymentButton.waitFor({ state: 'visible' });

    // Open and verify cart
    await CIE.getByLabel('Apri riepilogo pagamento').click();
    const municipalityCode = CIE.getByText(municipality.value);
    await municipalityCode.waitFor({ state: 'visible' });
    await CIE.getByLabel('Chiudi').click();

    // Verify email is pre-filled
    await expect(CIE.getByLabel('Email')).toHaveValue(userData.email);
  });

  await test.step('Complete payment simulation', async () => {
    // Fill confirm email
    await CIE.getByLabel('Ripeti di nuovo').fill(userData.email);

    // Continue
    await CIE.getByRole('button', { name: 'Continua' }).click();

    // Select payment method
    await CIE.getByRole('button', { name: 'Carta di credito o debito' }).click();

    // Simulate successful completion
    await CIE.goto('/cittadini/cie/public/esito/pagamento-avviso-completato');
    await CIE.waitForURL('/cittadini/cie/public/esito/pagamento-avviso-completato');
  });
});
