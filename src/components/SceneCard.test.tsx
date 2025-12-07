import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SceneCard } from './SceneCard';
import type { Scene } from '../types/scene';

describe('SceneCard', () => {
  const mockScene: Scene = {
    id: '1',
    name: 'Test Scene',
    index: 0,
    source: 'both',
    lastModified: '2024-12-01T10:30:00Z',
    hasLocalBackup: true,
    notes: 'Test notes for the scene',
  };

  const mockOnLoad = vi.fn();
  const mockOnDelete = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders scene name', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Test Scene')).toBeInTheDocument();
    });

    it('renders scene notes when provided', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Test notes for the scene')).toBeInTheDocument();
    });

    it('does not render notes section when notes are empty', () => {
      const sceneWithoutNotes = { ...mockScene, notes: undefined };
      const { container } = render(
        <SceneCard
          scene={sceneWithoutNotes}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      const notesElements = container.querySelectorAll('.line-clamp-2');
      expect(notesElements.length).toBe(0);
    });

    it('renders slot index', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Slot 0')).toBeInTheDocument();
    });

    it('renders formatted last modified date', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/Last modified: Dec 1, 2024/)).toBeInTheDocument();
    });

    it('renders correct source label for "both"', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Synced')).toBeInTheDocument();
    });

    it('renders correct source label for "x32"', () => {
      const x32Scene = { ...mockScene, source: 'x32' as const };
      render(
        <SceneCard
          scene={x32Scene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('X32 Only')).toBeInTheDocument();
    });

    it('renders correct source label for "local"', () => {
      const localScene = { ...mockScene, source: 'local' as const };
      render(
        <SceneCard
          scene={localScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Local Only')).toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    it('shows active indicator when isActive is true', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={true}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('does not show active indicator when isActive is false', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.queryByText('Active')).not.toBeInTheDocument();
    });

    it('applies ring styling when active', () => {
      const { container } = render(
        <SceneCard
          scene={mockScene}
          isActive={true}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      const card = container.querySelector('.card');
      expect(card).toHaveClass('ring-2');
    });

    it('shows "Loaded" text on button when active', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={true}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Loaded')).toBeInTheDocument();
    });

    it('disables load button when active', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={true}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      const loadButton = screen.getByRole('button', { name: /loaded/i });
      expect(loadButton).toBeDisabled();
    });
  });

  describe('Button Interactions', () => {
    it('calls onLoad when load button is clicked', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      const loadButton = screen.getByRole('button', { name: /load scene/i });
      fireEvent.click(loadButton);

      expect(mockOnLoad).toHaveBeenCalledTimes(1);
    });

    it('calls onDelete when delete button is clicked', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete scene/i });
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('does not call onLoad when load button is disabled', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={true}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      const loadButton = screen.getByRole('button', { name: /loaded/i });
      fireEvent.click(loadButton);

      expect(mockOnLoad).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('disables load button when loading', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
          isLoading={true}
        />
      );

      const loadButton = screen.getByRole('button', { name: '' });
      expect(loadButton).toBeDisabled();
    });

    it('disables delete button when loading', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
          isLoading={true}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete scene/i });
      expect(deleteButton).toBeDisabled();
    });

    it('shows spinner when loading', () => {
      const { container } = render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
          isLoading={true}
        />
      );

      const spinner = container.querySelector('.spinner');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Source Colors', () => {
    it('applies correct colors for "both" source', () => {
      render(
        <SceneCard
          scene={mockScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      const badge = screen.getByText('Synced');
      expect(badge).toHaveClass('badge', 'badge-both');
    });

    it('applies correct colors for "x32" source', () => {
      const x32Scene = { ...mockScene, source: 'x32' as const };
      render(
        <SceneCard
          scene={x32Scene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      const badge = screen.getByText('X32 Only');
      expect(badge).toHaveClass('badge', 'badge-x32');
    });

    it('applies correct colors for "local" source', () => {
      const localScene = { ...mockScene, source: 'local' as const };
      render(
        <SceneCard
          scene={localScene}
          isActive={false}
          onLoad={mockOnLoad}
          onDelete={mockOnDelete}
        />
      );

      const badge = screen.getByText('Local Only');
      expect(badge).toHaveClass('badge', 'badge-local');
    });
  });
});
