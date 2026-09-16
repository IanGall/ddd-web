import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';

// 1. ResizeObserver stub (保留现有实现)
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = window.ResizeObserver || ResizeObserverStub;
globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverStub;

// 2. window.matchMedia stub (集中提供给全局测试环境)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// 3. Element.prototype.scrollIntoView stub (no-op)
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// 4. Element.prototype pointer capture stubs (Base UI / Radix 交互基座)
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

// 5. window.PointerEvent stub (若环境缺失则赋最小实现)
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventStub extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? false;
    }
  }

  window.PointerEvent = PointerEventStub as unknown as typeof PointerEvent;
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clear();
});
