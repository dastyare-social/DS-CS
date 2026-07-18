import { beforeEach, describe, expect, it, vi } from 'bun:test'
import { render } from '@testing-library/react'
import React from 'react'
import '@testing-library/jest-dom/vitest'
import { Window } from 'happy-dom'

vi.mock('../short', () => ({
  default: ({ short }: any) => <div data-testid="short-item">{short.id}</div>,
}))

import Shorts from '../shorts'

beforeEach(() => {
  const window = new Window()
  globalThis.window = window as any
  globalThis.document = window.document as any
  globalThis.navigator = window.navigator as any
  document.body.innerHTML = ''
})

describe('Shorts', () => {
  it('renders one short item per item provided', () => {
    const { getAllByTestId } = render(
      <Shorts
        shorts={[{ id: 's1' }, { id: 's2' }] as any}
        likedStates={[false, false]}
        likeCounts={[0, 0]}
        videoLoadingStates={[false, false]}
        videoPreloadStates={[false, false]}
        activeIndex={0}
        lastSecondsVisibleIndex={0}
        videoRefs={{ current: [] } as any}
        containerRefs={{ current: [] } as any}
        scrollContainerRef={{ current: null }}
        onContainerClick={() => {}}
        onToggleLike={() => {}}
        onVideoPlay={() => {}}
        onVideoEnded={() => {}}
        onSwitchToThreads={() => {}}
        onWaiting={() => {}}
        onLoadStart={() => {}}
        onLoadedData={() => {}}
        onCanPlay={() => {}}
        onPlaying={() => {}}
        onStalled={() => {}}
        onError={() => {}}
      />,
    )

    expect(getAllByTestId('short-item')).toHaveLength(2)
  })
})
