import { cie as test, RANDOMNESS_CONFIG } from './fixtures/cie.fixture.ts';
import { SELECTORS } from '../../utils/index.ts';
import { expect } from '@playwright/test';

// Disable randomness
RANDOMNESS_CONFIG.enableStep2bNavigation = false;
RANDOMNESS_CONFIG.enableStep3bNavigation = false;

// ============================================================================
// TESTS - Payment Cancellation
// ============================================================================

test('CIE-004 - Come cittadino voglio pagare online per richiedere o rinnovare la Carta di Identità elettronica, ma decido di annullare il pagamento', async ({
  CIE
}) => {
  await test.step('Proceed to payment checkout', async () => {
    await CIE.getByTestId(SELECTORS.buttons.pay).click();
    await CIE.waitForURL(/checkout\.pagopa\.it\//, { timeout: 15000 });
    await CIE.getByLabel('Email').waitFor({ state: 'visible' });
  });

  await test.step('Cancel payment on checkout', async () => {
    await CIE.getByRole('button', { name: 'Indietro' }).click();

    // Verify cancellation page
    await expect(CIE.getByTestId('courtesyPage.title')).toBeVisible();
    await expect(CIE.getByTestId('courtesyPage.cta')).toBeVisible();
    await expect(CIE).toHaveURL(/esito\/pagamento-annullato/);
  });
});

test("CIE-005 - Come cittadino voglio annullare il pagamento online per richiedere o rinnovare la Carta di Identità elettronica, ma poi decido di scaricare l'avviso", async ({
  CIE
}) => {
  await test.step('Proceed to payment checkout', async () => {
    await CIE.getByTestId(SELECTORS.buttons.pay).click();
    await CIE.waitForURL(/checkout\.pagopa\.it\//, { timeout: 15000 });
  });

  await test.step('Cancel payment on checkout', async () => {
    await CIE.getByRole('button', { name: 'Indietro' }).click();
    await CIE.waitForURL(/esito\/pagamento-annullato/);
  });

  await test.step('Download payment notice from cancellation page', async () => {
    const downloadCta = CIE.getByTestId('courtesyPage.downloadCta');
    // The CTA href is built from an async installments fetch; until it resolves
    // the link points to a fallback courtesy page (not the download route), so
    // clicking too early opens the wrong tab and no download ever fires.
    await expect(downloadCta).toHaveAttribute('href', /spontanei\/download/);

    const newPagePromise = CIE.waitForEvent('popup');
    await downloadCta.click();

    const newPage = await newPagePromise;
    const download = await newPage.waitForEvent('download');
    const filename = download.suggestedFilename();

    if (!filename.includes('.pdf')) {
      throw new Error(`Expected PDF filename, got: ${filename}`);
    }

    expect(filename).toContain('.pdf');
  });
});
