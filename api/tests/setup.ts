import { vi } from 'vitest';

vi.mock('../src/db/pool.js', () => ({
  default: {
    query: vi.fn(),
    end: vi.fn(),
  },
}));
