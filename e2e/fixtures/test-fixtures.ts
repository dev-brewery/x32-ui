import { test as base, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';
import { SaveSceneModal, CreateSceneModal, ConfirmModal } from '../pages/modals.page';

/**
 * Test fixtures for X32 Scene Manager E2E tests
 */

// Extend base test with custom fixtures
export const test = base.extend<{
  appPage: AppPage;
  saveSceneModal: SaveSceneModal;
  createSceneModal: CreateSceneModal;
  confirmModal: ConfirmModal;
}>({
  appPage: async ({ page }, use) => {
    const appPage = new AppPage(page);
    await appPage.goto();
    await appPage.waitForLoad();
    await use(appPage);
  },

  saveSceneModal: async ({ page }, use) => {
    const modal = new SaveSceneModal(page);
    await use(modal);
  },

  createSceneModal: async ({ page }, use) => {
    const modal = new CreateSceneModal(page);
    await use(modal);
  },

  confirmModal: async ({ page }, use) => {
    const modal = new ConfirmModal(page);
    await use(modal);
  },
});

export { expect };

/**
 * Test data for scene operations
 */
export const testScenes = {
  basic: {
    name: 'E2E Test Scene',
    notes: 'Created by Playwright E2E test',
  },
  withNotes: {
    name: 'Scene With Notes',
    notes: 'This scene has detailed notes for testing',
  },
  minimal: {
    name: 'Minimal Scene',
  },
  uniquePrefix: () => ({
    name: `Test Scene ${Date.now()}`,
    notes: 'Unique scene for isolation',
  }),
};

/**
 * Helper to generate unique scene names
 */
export function uniqueSceneName(prefix = 'E2E Test'): string {
  return `${prefix} ${Date.now()}`;
}

/**
 * Common test utilities
 */
export const testUtils = {
  /**
   * Wait for a short delay (use sparingly)
   */
  async shortDelay(ms = 500): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generate a random string for unique identifiers
   */
  randomString(length = 8): string {
    return Math.random().toString(36).substring(2, 2 + length);
  },
};
