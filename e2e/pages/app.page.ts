import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Main Application Page Object
 * Provides access to all main UI elements and interactions
 */
export class AppPage extends BasePage {
  // Header elements
  readonly header: Locator;
  readonly title: Locator;
  readonly connectionStatus: Locator;
  readonly refreshButton: Locator;
  readonly saveButton: Locator;
  readonly createButton: Locator;

  // Scene list elements
  readonly searchInput: Locator;
  readonly sceneGrid: Locator;
  readonly sceneCards: Locator;
  readonly loadingSpinner: Locator;
  readonly emptyState: Locator;

  // Toast container
  readonly toastContainer: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.header = page.locator('header');
    this.title = page.locator('h1');
    this.connectionStatus = page.locator('[class*="connection"]').first();
    this.refreshButton = page.getByRole('button', { name: /refresh/i });
    this.saveButton = page.getByRole('button', { name: /save/i });
    this.createButton = page.getByRole('button', { name: /create/i });

    // Scene list
    this.searchInput = page.getByPlaceholder('Search scenes...');
    this.sceneGrid = page.locator('.scene-grid');
    this.sceneCards = page.locator('.card');
    this.loadingSpinner = page.locator('.spinner');
    this.emptyState = page.locator('text=No scenes');

    // Toast
    this.toastContainer = page.locator('.fixed.bottom-4.right-4');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    // Wait for either scenes to load or empty state
    await Promise.race([
      this.sceneGrid.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      this.emptyState.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {}),
    ]);
  }

  // --- Header Actions ---

  async clickSave(): Promise<void> {
    await this.saveButton.click();
  }

  async clickCreate(): Promise<void> {
    await this.createButton.click();
  }

  async clickRefresh(): Promise<void> {
    await this.refreshButton.click();
  }

  // --- Search Actions ---

  async searchScenes(term: string): Promise<void> {
    await this.searchInput.fill(term);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
  }

  // --- Scene Card Actions ---

  async getSceneCount(): Promise<number> {
    return this.sceneCards.count();
  }

  async getSceneCard(sceneName: string): Promise<Locator> {
    return this.page.locator('.card').filter({ hasText: sceneName });
  }

  async clickLoadScene(sceneName: string): Promise<void> {
    const card = await this.getSceneCard(sceneName);
    await card.getByRole('button', { name: /load/i }).click();
  }

  async clickDeleteScene(sceneName: string): Promise<void> {
    const card = await this.getSceneCard(sceneName);
    await card.getByRole('button', { name: /delete/i }).click();
  }

  async isSceneActive(sceneName: string): Promise<boolean> {
    const card = await this.getSceneCard(sceneName);
    const activeIndicator = card.locator('text=Active');
    return activeIndicator.isVisible();
  }

  async getSceneNames(): Promise<string[]> {
    const names: string[] = [];
    const cards = this.sceneCards;
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const name = await cards.nth(i).locator('h3').textContent();
      if (name) names.push(name);
    }

    return names;
  }

  // --- Toast Assertions ---

  async expectToast(message: string | RegExp): Promise<void> {
    const toast = this.page.locator('.toast').filter({ hasText: message });
    await expect(toast).toBeVisible({ timeout: 5000 });
  }

  async expectSuccessToast(message: string | RegExp): Promise<void> {
    const toast = this.page.locator('.toast-success').filter({ hasText: message });
    await expect(toast).toBeVisible({ timeout: 5000 });
  }

  async expectErrorToast(message: string | RegExp): Promise<void> {
    const toast = this.page.locator('.toast-error').filter({ hasText: message });
    await expect(toast).toBeVisible({ timeout: 5000 });
  }

  // --- Connection Status ---

  async getConnectionStatus(): Promise<string> {
    const text = await this.connectionStatus.textContent();
    return text || '';
  }

  async expectConnected(): Promise<void> {
    await expect(this.connectionStatus).toContainText(/connected/i);
  }

  async expectDisconnected(): Promise<void> {
    await expect(this.connectionStatus).toContainText(/disconnected/i);
  }
}
