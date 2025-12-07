import { Page, Locator, expect } from '@playwright/test';

/**
 * Modal Base Class
 */
export abstract class ModalPage {
  readonly page: Page;
  readonly modal: Locator;
  readonly title: Locator;
  readonly closeButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('[class*="modal"]').filter({ has: page.locator('form, p') });
    this.title = this.modal.locator('h2, h3').first();
    this.closeButton = this.modal.getByRole('button', { name: /close/i });
    this.cancelButton = this.modal.getByRole('button', { name: /cancel/i });
  }

  async isVisible(): Promise<boolean> {
    return this.modal.isVisible();
  }

  async waitForOpen(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  async waitForClose(): Promise<void> {
    await this.modal.waitFor({ state: 'hidden' });
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForClose();
  }

  async getTitle(): Promise<string> {
    return (await this.title.textContent()) || '';
  }
}

/**
 * Save Scene Modal
 */
export class SaveSceneModal extends ModalPage {
  readonly nameInput: Locator;
  readonly notesInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput = page.locator('#scene-name');
    this.notesInput = page.locator('#scene-notes');
    this.submitButton = page.getByRole('button', { name: /save scene/i });
    this.errorMessage = this.modal.locator('.alert-error');
  }

  async fillName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  async fillNotes(notes: string): Promise<void> {
    await this.notesInput.fill(notes);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async saveScene(name: string, notes?: string): Promise<void> {
    await this.fillName(name);
    if (notes) {
      await this.fillNotes(notes);
    }
    await this.submit();
  }

  async expectError(message: string | RegExp): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }

  async expectNoError(): Promise<void> {
    await expect(this.errorMessage).not.toBeVisible();
  }
}

/**
 * Create Scene Modal
 */
export class CreateSceneModal extends ModalPage {
  readonly nameInput: Locator;
  readonly copyFromSelect: Locator;
  readonly notesInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput = page.locator('#new-scene-name');
    this.copyFromSelect = page.locator('#copy-from');
    this.notesInput = page.locator('#new-scene-notes');
    this.submitButton = page.getByRole('button', { name: /create scene/i });
    this.errorMessage = this.modal.locator('.alert-error');
  }

  async fillName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  async selectCopyFrom(sceneName: string): Promise<void> {
    await this.copyFromSelect.selectOption({ label: sceneName });
  }

  async fillNotes(notes: string): Promise<void> {
    await this.notesInput.fill(notes);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async createScene(name: string, options?: { copyFrom?: string; notes?: string }): Promise<void> {
    await this.fillName(name);
    if (options?.copyFrom) {
      await this.selectCopyFrom(options.copyFrom);
    }
    if (options?.notes) {
      await this.fillNotes(options.notes);
    }
    await this.submit();
  }

  async expectError(message: string | RegExp): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }

  async getCopyFromOptions(): Promise<string[]> {
    const options = this.copyFromSelect.locator('option');
    const count = await options.count();
    const labels: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text) labels.push(text);
    }

    return labels;
  }
}

/**
 * Confirm Modal (for Load/Delete confirmation)
 */
export class ConfirmModal extends ModalPage {
  readonly message: Locator;
  readonly confirmButton: Locator;

  constructor(page: Page) {
    super(page);
    this.message = this.modal.locator('p').first();
    this.confirmButton = this.modal.locator('button:not(:has-text("Cancel"))').last();
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }

  async getMessage(): Promise<string> {
    return (await this.message.textContent()) || '';
  }

  async expectMessage(expected: string | RegExp): Promise<void> {
    await expect(this.message).toContainText(expected);
  }

  async expectConfirmButtonText(text: string): Promise<void> {
    await expect(this.confirmButton).toHaveText(text);
  }
}
