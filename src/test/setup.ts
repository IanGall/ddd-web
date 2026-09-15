import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clear();
});
