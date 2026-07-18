import { beforeEach, describe, expect, it, vi } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import React from 'react'
import '@testing-library/jest-dom/vitest'
import { Window } from 'happy-dom'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('../stories', () => ({
  default: () => <div data-testid="stories" />,
}))

vi.mock('../reaction', () => ({
  default: ({ emoji, count, onClick }: any) => (
    <button data-testid="reaction" onClick={onClick}>
      {emoji} {count}
    </button>
  ),
}))

vi.mock('../context-menu', () => ({
  ContextMenu: ({ children }: any) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }: any) => <div>{children}</div>,
  ContextMenuContent: ({ children }: any) => <div>{children}</div>,
  ContextMenuItem: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}))

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}))

vi.mock('@/lib/render-post-markdown', () => ({
  renderSimpleMarkdown: (content: string) => content,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  formatCount: (count: number) => count.toString(),
}))

vi.mock('@/config/app', () => ({
  app_config: { en: { name: 'Test Name' }, general: { username: 'testuser' } },
}))

vi.mock('@/config/constants', () => ({
  reactionEmojis: ['👍'],
}))

vi.mock('@/lib/fonts', () => ({
  pally: { className: 'mock-font' },
}))

import Thread from '../thread'

beforeEach(() => {
  const window = new Window()
  globalThis.window = window as any
  globalThis.document = window.document as any
  globalThis.navigator = window.navigator as any
  document.body.innerHTML = ''
})

describe('Thread', () => {
  it('renders thread content and calls the reaction handler', () => {
    const onThreadReact = vi.fn()
    const { getByText, getByTestId } = render(
      <Thread
        thread={{ id: 't1', content: 'hello there', type: 'image', media: { url: '/image.png', width: 800, height: 600 }, reactions: [], views: '5', createdAt: new Date().toISOString() } as any}
        index={0}
        threadVideoRef={() => {}}
        onThreadReact={onThreadReact}
        isPullingRef={{ current: false }}
      />,
    )

    expect(getByText('hello there')).toBeInTheDocument()
    fireEvent.click(getByTestId('reaction'))
    expect(onThreadReact).toHaveBeenCalledWith('t1', '👍')
  })
})
