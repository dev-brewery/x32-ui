import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Toast, useToast, ToastContainer } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders message correctly', () => {
      const mockOnClose = vi.fn();
      render(
        <Toast message="Test message" type="success" onClose={mockOnClose} />
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('is visible initially', () => {
      const mockOnClose = vi.fn();
      const { container } = render(
        <Toast message="Test message" type="success" onClose={mockOnClose} />
      );

      const toast = container.querySelector('.toast');
      expect(toast).toHaveStyle({ opacity: 1 });
    });
  });

  describe('Type Styling', () => {
    it('has correct class for success type', () => {
      const mockOnClose = vi.fn();
      const { container } = render(
        <Toast message="Success" type="success" onClose={mockOnClose} />
      );

      const toast = container.querySelector('.toast');
      expect(toast).toHaveClass('toast-success');
    });

    it('has correct class for error type', () => {
      const mockOnClose = vi.fn();
      const { container } = render(
        <Toast message="Error" type="error" onClose={mockOnClose} />
      );

      const toast = container.querySelector('.toast');
      expect(toast).toHaveClass('toast-error');
    });

    it('has correct class for info type', () => {
      const mockOnClose = vi.fn();
      const { container } = render(
        <Toast message="Info" type="info" onClose={mockOnClose} />
      );

      const toast = container.querySelector('.toast');
      expect(toast).toHaveClass('toast-info');
    });
  });

  describe('Auto-dismiss', () => {
    it('calls onClose after default duration (3000ms)', () => {
      const mockOnClose = vi.fn();
      render(<Toast message="Test" type="success" onClose={mockOnClose} />);

      expect(mockOnClose).not.toHaveBeenCalled();

      // Fast-forward to duration (3000ms) + animation delay (300ms)
      act(() => {
        vi.advanceTimersByTime(3300);
      });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose after custom duration', () => {
      const mockOnClose = vi.fn();
      render(
        <Toast
          message="Test"
          type="success"
          duration={1000}
          onClose={mockOnClose}
        />
      );

      expect(mockOnClose).not.toHaveBeenCalled();

      // Fast-forward to custom duration (1000ms) + animation delay (300ms)
      act(() => {
        vi.advanceTimersByTime(1300);
      });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('fades out before calling onClose', () => {
      const mockOnClose = vi.fn();
      const { container } = render(
        <Toast message="Test" type="success" onClose={mockOnClose} />
      );

      const toast = container.querySelector('.toast');

      // Initially visible
      expect(toast).toHaveStyle({ opacity: 1 });

      // After duration, should be fading out
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(toast).toHaveStyle({ opacity: 0 });
      expect(mockOnClose).not.toHaveBeenCalled();

      // After animation delay, should call onClose
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('cleans up timer on unmount', () => {
      const mockOnClose = vi.fn();
      const { unmount } = render(
        <Toast message="Test" type="success" onClose={mockOnClose} />
      );

      unmount();

      // Should not call onClose after unmounting
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});

describe('ToastContainer', () => {
  it('renders multiple toasts', () => {
    const mockRemoveToast = vi.fn();
    const toasts = [
      { id: '1', message: 'First toast', type: 'success' as const },
      { id: '2', message: 'Second toast', type: 'error' as const },
      { id: '3', message: 'Third toast', type: 'info' as const },
    ];

    render(<ToastContainer toasts={toasts} removeToast={mockRemoveToast} />);

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
    expect(screen.getByText('Third toast')).toBeInTheDocument();
  });

  it('renders empty container when no toasts', () => {
    const mockRemoveToast = vi.fn();
    const { container } = render(
      <ToastContainer toasts={[]} removeToast={mockRemoveToast} />
    );

    const toastElements = container.querySelectorAll('.toast');
    expect(toastElements.length).toBe(0);
  });

  it('passes removeToast to each toast', () => {
    vi.useFakeTimers();
    const mockRemoveToast = vi.fn();
    const toasts = [{ id: '1', message: 'Test', type: 'success' as const }];

    render(<ToastContainer toasts={toasts} removeToast={mockRemoveToast} />);

    act(() => {
      vi.advanceTimersByTime(3300);
    });

    expect(mockRemoveToast).toHaveBeenCalledWith('1');

    vi.restoreAllMocks();
  });
});

describe('useToast', () => {
  it('initializes with empty toasts array', () => {
    let result: ReturnType<typeof useToast> | undefined;

    function TestComponent() {
      result = useToast();
      return null;
    }

    render(<TestComponent />);

    expect(result?.toasts).toEqual([]);
  });

  it('adds toast with addToast', () => {
    let result: ReturnType<typeof useToast> | undefined;

    function TestComponent() {
      result = useToast();
      return null;
    }

    render(<TestComponent />);

    act(() => {
      result?.addToast('Test message', 'success');
    });

    expect(result?.toasts).toHaveLength(1);
    expect(result?.toasts[0].message).toBe('Test message');
    expect(result?.toasts[0].type).toBe('success');
    expect(result?.toasts[0].id).toBeDefined();
  });

  it('adds multiple toasts', () => {
    let result: ReturnType<typeof useToast> | undefined;

    function TestComponent() {
      result = useToast();
      return null;
    }

    render(<TestComponent />);

    act(() => {
      result?.addToast('First', 'success');
      result?.addToast('Second', 'error');
      result?.addToast('Third', 'info');
    });

    expect(result?.toasts).toHaveLength(3);
    expect(result?.toasts[0].message).toBe('First');
    expect(result?.toasts[1].message).toBe('Second');
    expect(result?.toasts[2].message).toBe('Third');
  });

  it('removes toast with removeToast', () => {
    let hookResult!: ReturnType<typeof useToast>;

    function TestComponent() {
      hookResult = useToast();
      return <div data-testid="test">Toasts: {hookResult.toasts.length}</div>;
    }

    render(<TestComponent />);

    // Add two toasts
    act(() => {
      hookResult.addToast('First', 'success');
      hookResult.addToast('Second', 'error');
    });

    expect(hookResult.toasts).toHaveLength(2);
    const firstToastId = hookResult.toasts[0].id;

    // Remove first toast
    act(() => {
      hookResult.removeToast(firstToastId);
    });

    expect(hookResult.toasts).toHaveLength(1);
    expect(hookResult.toasts[0].message).toBe('Second');
  });

  it('generates unique IDs for toasts', () => {
    let result: ReturnType<typeof useToast> | undefined;

    function TestComponent() {
      result = useToast();
      return null;
    }

    render(<TestComponent />);

    act(() => {
      result?.addToast('First', 'success');
      result?.addToast('Second', 'success');
    });

    const ids = result?.toasts.map(t => t.id);
    expect(ids).toHaveLength(2);
    // Each toast should have a unique ID due to the counter
    expect(ids?.[0]).not.toBe(ids?.[1]);
  });
});
