import { test, expect } from '@playwright/test';

test.describe('Chat Application E2E Tests', () => {
  const BASE_URL = process.env.HERMES_E2E_BASE_URL || 'http://127.0.0.1:3001';

  test('loads the app and shows sidebar with sessions', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await expect(page.getByText('HERMES', { exact: true })).toBeVisible();
    await expect(page.locator('text=NEW_SESSION')).toBeVisible();
    await expect(page.locator('button:has-text("msgs")').first()).toBeVisible();
  });

  test('clicking a session loads messages', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const sessions = page.locator('button:has-text("msgs")');
    await expect(sessions.first()).toBeVisible({ timeout: 10000 });
    
    const sessionCount = await sessions.count();
    let sessionClicked = false;
    
    for (let i = 0; i < sessionCount; i++) {
      const text = await sessions.nth(i).textContent() || '';
      if (!/^\d+\s*msgs$/.test(text.trim())) {
        await sessions.nth(i).click();
        sessionClicked = true;
        break;
      }
    }
    
    if (!sessionClicked) {
      await sessions.first().click();
    }
    
    await expect(page.locator('text=Start a conversation')).not.toBeVisible({ timeout: 5000 });
    
    const userOrAssistant = page.locator('text=User').or(page.locator('text=Assistant'));
    await expect(userOrAssistant.first()).toBeVisible({ timeout: 5000 });
  });

  test('metadata panel shows session info when session selected', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.locator('button:has-text("msgs")').first().click();
    
    await expect(page.getByText('Model', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Tool Usage', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('search filters sessions', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const sessions = page.locator('button:has-text("msgs")');
    await expect(sessions.first()).toBeVisible({ timeout: 10000 });
    
    const initialCount = await sessions.count();
    
    await page.fill('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]', 'beacon');
    
    await page.waitForTimeout(500);
    
    const filteredCount = await sessions.count();
    expect(filteredCount).toBeLessThan(initialCount);
  });

  test('empty state shows start conversation message', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await expect(page.locator('text=Start a conversation')).toBeVisible();
    await expect(page.locator('text=Select a session')).toBeVisible();
  });
});