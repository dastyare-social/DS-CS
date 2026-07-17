import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { render } from '@testing-library/react';
import Header from '../header';
import React from 'react';
import { Window } from 'happy-dom';

// Mock dependencies first
vi.mock('next/image', () => ({
  default: (props: any) => React.createElement('img', props),
}));

vi.mock('@/lib/hooks/use-posts', () => ({
  usePosts: () => ({
    posts: [],
    total: 0,
    isLoading: false,
  }),
}));

vi.mock('@/lib/fonts', () => ({
  pally: { className: 'mock-font' },
}));

vi.mock('@/config/app', () => ({
  app_config: {
    en: { name: 'Test User' },
    fa: { name: 'کاربر تست' },
  },
}));

vi.mock('@/config/locale', () => ({
  Locale: ['en', 'fa'],
}));

vi.mock('@/lib/utils', () => ({
  capitalize: (s: string) => s,
  cn: (...args: any) => args.join(' '),
  formatTimeAgo: () => ({ key: 'test', values: {} }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('lucide-react', () => ({
  CircleDashedIcon: (props: any) => React.createElement('div', props),
}));

vi.mock('../dialog', () => ({
  Dialog: ({ children }: any) => children,
  DialogTrigger: ({ children }: any) => children,
  DialogContent: ({ children }: any) => children,
}));

vi.mock('../stories', () => ({
  default: ({ size }: any) => React.createElement('div', { 'data-testid': 'stories', size }),
}));

vi.mock('../modals/profile', () => ({
  default: () => React.createElement('div', { 'data-testid': 'profile-modal' }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => React.createElement('a', { href }, children),
}));

vi.mock('@/config/routes', () => ({
  routes: {
    explore: '/explore',
    default: '/',
  },
}));

beforeEach(() => {
  const window = new Window();
  globalThis.window = window as any;
  globalThis.document = window.document as any;
  globalThis.navigator = window.navigator as any;
  document.body.innerHTML = '';
});

describe('Header Component', () => {
  it('renders without crashing', () => {
    const { container } = render(<Header />);
    expect(container).toBeTruthy();
  });

  it('shows explore button when explore prop is true', () => {
    const { getByText } = render(<Header explore={true} />);
    expect(getByText('general.explore')).toBeTruthy();
  });

  it('shows new story button when new_story prop is true', () => {
    const { getByText } = render(<Header new_story={true} />);
    expect(getByText('general.new_story')).toBeTruthy();
  });

  it('shows back to channel button when back_to_channel prop is true', () => {
    const { getByText } = render(<Header back_to_channel={true} />);
    expect(getByText('general.channel')).toBeTruthy();
  });

  it('displays post count when postsData is provided', () => {
    const testPosts = [
      {
        id: '1',
        type: 'text' as const,
        content: 'Test post',
        views: '0',
        pinnedAt: null,
        media: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        reactions: [],
      },
    ];

    const { getByText } = render(
      <Header postsData={testPosts} totalCount={5} />
    );
    expect(getByText('general.posts')).toBeTruthy();
  });
});
