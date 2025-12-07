import { test, expect, uniqueSceneName } from '../fixtures/test-fixtures';

test.describe('Scene Save Flow', () => {
  test('should open save modal when clicking Save button', async ({
    appPage,
    saveSceneModal,
  }) => {
    await appPage.clickSave();
    await saveSceneModal.waitForOpen();

    await expect(saveSceneModal.modal).toBeVisible();
    await expect(saveSceneModal.nameInput).toBeVisible();
    await expect(saveSceneModal.notesInput).toBeVisible();
    await expect(saveSceneModal.submitButton).toBeVisible();
  });

  test('should close save modal when clicking Cancel', async ({
    appPage,
    saveSceneModal,
  }) => {
    await appPage.clickSave();
    await saveSceneModal.waitForOpen();

    await saveSceneModal.cancel();

    await expect(saveSceneModal.modal).not.toBeVisible();
  });

  test('should show validation error when submitting without name', async ({
    appPage,
    saveSceneModal,
  }) => {
    await appPage.clickSave();
    await saveSceneModal.waitForOpen();

    // Try to submit without entering a name
    await saveSceneModal.submit();

    // Should show error
    await saveSceneModal.expectError(/name is required/i);
  });

  test('should save scene successfully with name only', async ({
    appPage,
    saveSceneModal,
  }) => {
    const sceneName = uniqueSceneName('Save Test');

    await appPage.clickSave();
    await saveSceneModal.waitForOpen();

    await saveSceneModal.fillName(sceneName);
    await saveSceneModal.submit();

    // Modal should close
    await saveSceneModal.waitForClose();

    // Success toast should appear
    await appPage.expectSuccessToast(/saved successfully/i);
  });

  test('should save scene successfully with name and notes', async ({
    appPage,
    saveSceneModal,
  }) => {
    const sceneName = uniqueSceneName('Save Notes Test');
    const notes = 'Test notes for the scene';

    await appPage.clickSave();
    await saveSceneModal.waitForOpen();

    await saveSceneModal.saveScene(sceneName, notes);

    // Modal should close
    await saveSceneModal.waitForClose();

    // Success toast should appear
    await appPage.expectSuccessToast(/saved successfully/i);
  });

  test('should clear form when reopening save modal', async ({
    appPage,
    saveSceneModal,
  }) => {
    // Open and fill some data
    await appPage.clickSave();
    await saveSceneModal.waitForOpen();
    await saveSceneModal.fillName('Temporary Name');
    await saveSceneModal.fillNotes('Temporary Notes');

    // Cancel
    await saveSceneModal.cancel();

    // Reopen
    await appPage.clickSave();
    await saveSceneModal.waitForOpen();

    // Fields should be empty
    await expect(saveSceneModal.nameInput).toHaveValue('');
    await expect(saveSceneModal.notesInput).toHaveValue('');
  });

  test('should respect max length for scene name', async ({
    appPage,
    saveSceneModal,
  }) => {
    await appPage.clickSave();
    await saveSceneModal.waitForOpen();

    // Check max length attribute
    await expect(saveSceneModal.nameInput).toHaveAttribute('maxlength', '32');
  });
});
