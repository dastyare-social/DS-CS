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
  reactionEmojis: ['👍', '❤️'],
}));

import { render } from '@testing-library/react';
import Post from '../post';
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

  it('renders post content', () => {
    const { getByText } = render(<Post post={mockPost} />);
    expect(getByText('Hello, world!')).toBeInTheDocument();
  });
});
