import { describe, it, expect, beforeEach, vi } from 'bun:test';

// Mock dependencies first
vi.mock('next/image', () => ({
  default: (props: any) => React.createElement('img', props),
}));

vi.mock('next/font/local', () => ({
  default: () => ({ className: 'mock-local-font' }),
}));

vi.mock('@/lib/fonts', () => ({
  LangDir: () => 'ltr',
  LangFont: () => 'mock-font',
}));

vi.mock('@/config/app', () => ({
  app_config: {
    en: { name: 'Test User' },
    fa: { name: 'کاربر تست' },
  },
}));

vi.mock('@/config/locale', () => ({
  Locale: ['en'],
}));

vi.mock('@/lib/actions/stories', () => ({
  getStories: vi.fn(),
  incrementStoryViews: vi.fn(),
  toggleStoryLike: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any) => args.join(' '),
  formatCount: (count: number) => count.toString(),
  formatTimeAgo: () => ({ key: 'test-key', values: {} }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('lucide-react', () => ({
  HeartIcon: (props: any) => React.createElement('div', { ...props, 'data-testid': 'heart-icon' }),
}));

vi.mock('../dialog', () => ({
  Dialog: ({ children }: any) => children,
  DialogTrigger: ({ children }: any) => children,
  DialogContent: ({ children }: any) => children,
}));

vi.mock('../loader', () => ({
  default: ({ className }: any) => React.createElement('div', { className }),
}));

vi.mock('../modals/profile', () => ({
  default: () => React.createElement('div', { 'data-testid': 'profile-modal' }),
}));

import { render } from '@testing-library/react';
import Stories from '../stories';
import React from 'react';
import { Window } from 'happy-dom';

beforeEach(() => {
  const window = new Window();
  globalThis.window = window as any;
  globalThis.document = window.document as any;
  globalThis.navigator = window.navigator as any;
  document.body.innerHTML = '';
});

describe('Stories Component', () => {
  it('renders without crashing', () => {
    const { container } = render(<Stories size={35} />);
    expect(container).toBeTruthy();
  });
});
