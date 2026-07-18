import { beforeEach, describe, expect, it, vi } from 'bun:test'
import { render } from '@testing-library/react'
import React from 'react'
import '@testing-library/jest-dom/vitest'
import { Window } from 'happy-dom'

vi.mock('../thread', () => ({
  default: () => <div data-testid="thread-item" />,
}))

vi.mock('../pull-refresh-loader', () => ({
  default: () => <div data-testid="pull-refresh-loader" />,
}))

vi.mock('../new-threads-banner', () => ({
  default: ({ count }: any) => <div data-testid="new-threads-banner">{count}</div>,
}))

vi.mock('../loader', () => ({
  default: () => <div data-testid="loader" />,
}))

class MockIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  const window = new Window()
  globalThis.window = window as any
  globalThis.document = window.document as any
  globalThis.navigator = window.navigator as any
  ;(globalThis as any).IntersectionObserver = MockIntersectionObserver
  document.body.innerHTML = ''
})

import Threads from '../threads'

describe('Threads', () => {
  it('renders banner and thread items for the provided threads', () => {
    const { getByTestId } = render(
      <Threads
        threads={[{ id: 't1', content: 'hello', type: 'text', views: '3', reactions: [], createdAt: new Date().toISOString() } as any]}
        threadsError={null}
        isRefreshingThreads={false}
        isApplyingNewThreads={false}
        newThreadsCount={2}
        isLoadingMoreThreads={false}
        hasMoreThreads={false}
        threadsPageRef={{ current: null }}
        threadsScrollRef={{ current: null }}
        threadsListRef={{ current: null }}
        threadsSentinelRef={{ current: null }}
        threadVideoRefs={{ current: [] } as any}
        isPullingRef={{ current: false } as any}
        refreshLoaderHeight={0}
        refreshLoaderOpacity={1}
        clampedPull={0}
        onShowNewThreads={() => {}}
        onThreadReact={() => {}}
        onVideoPlay={() => {}}
        loadMore={() => {}}
      />,
    )

    expect(getByTestId('thread-item')).toBeInTheDocument()
    expect(getByTestId('new-threads-banner').textContent).toBe('2')
  })
})
