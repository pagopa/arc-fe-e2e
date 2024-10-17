import fs from 'fs';
import { Page } from '@playwright/test';
import { jwtDecode } from 'jwt-decode';

export const userPath = 'auth/user.json';

// Helper function to wait for the fulfilled response
export async function getFulfilledResponse(page: Page, path: string) {
  const response = await page.waitForResponse(async (response) => {
    if (!response.url().includes(path)) return false;
    return true;
  });
  return response.json();
}

export function isValidDate(d: string) {
  const date = new Date(d);
  // If the date object is invalid it
  // will return 'NaN' on getTime()
  // and NaN is never equal to itself
  return date.getTime() === date.getTime();
}

// Auth phase can be skipped when an user.json file exists and the token is still valid
export const skipAuth = async (): Promise<boolean> =>
  new Promise((resolve) => {
    if (fs.existsSync(userPath)) {
      fs.readFile(userPath, 'utf8', (err, jsonString) => {
        if (err) {
          console.log('File read failed:', err);
          return resolve(false);
        }
        try {
          const origins = JSON.parse(jsonString).origins;
          const arc = origins.find(({ origin }: { origin: string }) =>
            origin.includes(process.env.BASE_URL || 'cittadini.pagopa.it')
          );
          const token = arc.localStorage.find(
            ({ name }: { name: string }) => name === 'accessToken'
          ).value;
          const decoded = jwtDecode(token);
          const now = Math.floor(Date.now() / 1000);
          const expire = decoded.exp || 0;
          resolve(now < expire);
        } catch (err) {
          console.log('Error parsing JSON string:', err);
          resolve(false);
        }
      });
    } else {
      resolve(false);
    }
  });
