import { mock } from 'bun:test';
import '@testing-library/jest-dom';

mock.module('next/font/local', () => ({
  default: () => ({ className: 'mock-font' }),
}));
