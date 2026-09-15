import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = window.ResizeObserver || ResizeObserverStub;
globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverStub;

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clear();
});
