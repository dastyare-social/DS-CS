import { mock } from 'bun:test';

mock.module('next/font/local', () => ({
  default: () => ({ className: 'mock-font' }),
}));
