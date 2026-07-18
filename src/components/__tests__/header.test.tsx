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
  capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
  cn: (...args: any) => args.join(' '),
  formatTimeAgo: () => ({ key: 'test', values: {} }),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => {
    if (namespace === 'last_time') return 'just now';
    const translations: Record<string, string> = {
      'general.app_name': 'Test App',
      'general.posts': 'posts',
      'general.published': 'published',
      'general.not_posted_any_content_yet': 'No content yet',
      'general.posted': 'Posted',
      'general.explore': 'explore',
      'general.channel': 'channel',
      'general.new_story': 'new story',
    };
    return translations[key] ?? key;
  },
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
    const { getByRole } = render(<Header explore={true} />);
    expect(getByRole('link', { name: /explore/i })).toBeTruthy();
  });

  it('shows new story button when new_story prop is true', () => {
    const { getByText } = render(<Header new_story={true} />);
    expect(getByText('new story')).toBeTruthy();
  });

  it('shows back to channel button when back_to_channel prop is true', () => {
    const { getByRole } = render(<Header back_to_channel={true} />);
    expect(getByRole('link', { name: /channel/i })).toBeTruthy();
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
    expect(getByText(/posts/i)).toBeTruthy();
  });
});
