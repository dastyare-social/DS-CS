import { describe, it, expect, beforeEach, vi } from 'bun:test';

// Mock dependencies first, before any imports
vi.mock('next/image', () => ({
  default: (props: any) => React.createElement('img', props),
}));

vi.mock('next/font/local', () => ({
  default: () => ({ className: 'mock-local-font' }),
}));

vi.mock('@/lib/fonts', () => ({
  pally: { className: 'mock-font' },
}));

vi.mock('../context-menu', () => ({
  ContextMenu: ({ children }: any) => children,
  ContextMenuTrigger: ({ children }: any) => children,
  ContextMenuContent: ({ children }: any) => null,
  ContextMenuItem: ({ children, onClick }: any) =>
    React.createElement('button', { onClick }, children),
  ContextMenuEmojiBar: ({ emojis, onSelect }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'emoji-bar' },
      (emojis || []).map((emoji: string) =>
        React.createElement(
          'button',
          { key: emoji, 'data-testid': `emoji-${emoji}`, onClick: () => onSelect(emoji) },
          emoji,
        ),
      ),
    ),
}));

vi.mock('../stories', () => ({
  default: ({ size }: any) => React.createElement('div', { 'data-testid': 'stories', size }),
}));

vi.mock('../reaction', () => ({
  default: ({ emoji, count, onClick }: any) => 
    React.createElement('button', { onClick, 'data-testid': 'reaction' }, `${emoji} ${count}`),
}));

vi.mock('../dialog', () => ({
  Dialog: ({ children }: any) => children,
  DialogTrigger: ({ children }: any) => children,
  DialogContent: ({ children }: any) => children,
}));

vi.mock('@/lib/actions/posts', () => ({
  addReaction: vi.fn(),
  deletePost: vi.fn(),
  viewPost: vi.fn(),
}));

vi.mock('@/lib/render-post-markdown', () => ({
  renderSimpleMarkdown: (content: string) => content,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/config/constants', () => ({
  quickReactionEmojis: ['👍', '❤️'],
}));

import { render, fireEvent, waitFor } from '@testing-library/react';
import Post from '../post';
import { addReaction, viewPost } from '@/lib/actions/posts';
import React from 'react';
import { Window } from 'happy-dom';

beforeEach(() => {
  const window = new Window();
  globalThis.window = window as any;
  globalThis.document = window.document as any;
  globalThis.navigator = window.navigator as any;
  globalThis.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: () => null,
  } as any;
  document.body.innerHTML = '';
});

describe('Post Component', () => {
  const mockPost = {
    id: 'test-post-id',
    type: 'text' as const,
    content: 'Hello, world!',
    views: '100',
    pinnedAt: null,
    media: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    reactions: [{ emoji: '👍', count: 5 }],
  };

  beforeEach(() => {
    (addReaction as any).mockReset();
    (viewPost as any).mockReset();
    (addReaction as any).mockResolvedValue({ emoji: '👍', count: 6 });
    (viewPost as any).mockResolvedValue({ views: '101' });
  });

  it('renders post content', () => {
    const { getByText } = render(<Post post={mockPost} />);
    expect(getByText('Hello, world!')).toBeTruthy();
  });

  it('rolls back the reaction count and shows a retry when the request fails', async () => {
    (addReaction as any).mockRejectedValueOnce(new Error('Failed to fetch'));

    const { getByTestId, getByText } = render(<Post post={mockPost} />);

    fireEvent.click(getByTestId('reaction'));

    // Retry affordance appears once the failed request settles
    await waitFor(() => expect(getByText('general.reaction_failed')).toBeTruthy());
    // Count is back to its original value, not the optimistic +1
    expect(getByTestId('reaction').textContent).toBe('👍 5');
  });

  it('keeps the optimistic reaction count when the request succeeds', async () => {
    const { getByTestId, queryByText } = render(<Post post={mockPost} />);

    fireEvent.click(getByTestId('reaction'));

    await waitFor(() => expect((addReaction as any).mock.calls.length).toBe(1));
    expect(getByTestId('reaction').textContent).toBe('👍 6');
    expect(queryByText('general.reaction_failed')).toBeNull();
  });

  it('does not persist the viewed marker when the view request fails', async () => {
    (viewPost as any).mockRejectedValueOnce(new Error('Failed to fetch'));

    render(<Post post={mockPost} />);

    await waitFor(() => expect((viewPost as any).mock.calls.length).toBe(1));
    // A failed view must not leave a marker, so it can be retried later
    expect(window.localStorage.getItem('message_viewed_test-post-id')).toBeNull();
  });

  it('persists the viewed marker only after the view request succeeds', async () => {
    render(<Post post={mockPost} />);

    await waitFor(() =>
      expect(window.localStorage.getItem('message_viewed_test-post-id')).toBe('1'),
    );
  });
});
