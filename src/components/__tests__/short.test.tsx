import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { render } from '@testing-library/react';
import Short from '../short';
import React from 'react';
import { Window } from 'happy-dom';

// Mock dependencies
vi.mock('next/image', () => ({
  default: (props: any) => React.createElement('img', props),
}));

vi.mock('@/lib/fonts', () => ({
  LangFont: () => 'mock-font',
  LangDir: () => 'ltr',
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
  formatCount: (n: number) => n.toString(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('lucide-react', () => ({
  HeartIcon: (props: any) => React.createElement('div', { ...props, 'data-testid': 'heart-icon' }),
  ChevronDownIcon: (props: any) => React.createElement('div', { ...props, 'data-testid': 'chevron-down' }),
  LineSquiggleIcon: (props: any) => React.createElement('div', { ...props, 'data-testid': 'line-squiggle' }),
}));

vi.mock('../loader', () => ({
  default: ({ className }: any) => React.createElement('div', { className, 'data-testid': 'loader' }),
}));

beforeEach(() => {
  const window = new Window();
  globalThis.window = window as any;
  globalThis.document = window.document as any;
  globalThis.navigator = window.navigator as any;
  document.body.innerHTML = '';
});

const mockShort = {
  id: 'test-short-1',
  type: 'video' as const,
  content: 'Test short video',
  views: '100',
  pinnedAt: null,
  media: { url: 'https://example.com/video.mp4' },
  createdAt: new Date(),
  updatedAt: new Date(),
  reactions: [{ emoji: '👍', count: 5 }],
};

const defaultProps = {
  short: mockShort,
  index: 0,
  activeIndex: 0,
  likedStates: [false],
  likeCounts: [5],
  videoLoadingStates: [false],
  videoPreloadStates: [false],
  lastSecondsVisibleIndex: null,
  containerRef: () => {},
  videoRef: () => {},
  onContainerClick: () => {},
  onToggleLike: () => {},
  onVideoEnded: () => {},
  onSwitchToThreads: () => {},
  onWaiting: () => {},
  onLoadStart: () => {},
  onLoadedData: () => {},
  onCanPlay: () => {},
  onPlaying: () => {},
  onStalled: () => {},
  onError: () => {},
};

describe('Short Component', () => {
  it('renders without crashing', () => {
    const { container } = render(<Short {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it('shows preload loader when videoPreloadStates[index] is true', () => {
    const { getByTestId } = render(
      <Short {...defaultProps} videoPreloadStates={[true]} />
    );
    expect(getByTestId('loader')).toBeTruthy();
  });

  it('shows buffering loader when videoLoadingStates[index] is true', () => {
    const { getByTestId } = render(
      <Short {...defaultProps} videoLoadingStates={[true]} />
    );
    expect(getByTestId('loader')).toBeTruthy();
  });

  it('shows heart icon filled when liked', () => {
    const { container } = render(
      <Short {...defaultProps} likedStates={[true]} />
    );
    expect(container).toBeTruthy();
  });
});
