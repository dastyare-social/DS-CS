import { describe, it, expect, beforeEach } from 'bun:test';
import { render, screen } from '@testing-library/react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '../context-menu';
import React from 'react';
import { Window } from 'happy-dom';

beforeEach(() => {
  const window = new Window();
  globalThis.window = window as any;
  globalThis.document = window.document as any;
  globalThis.navigator = window.navigator as any;
  document.body.innerHTML = '';
});

describe('ContextMenu Components', () => {
  it('renders ContextMenu with Trigger and Content', () => {
    const { getByTestId } = render(
      <ContextMenu>
        <ContextMenuTrigger>
          <div data-testid="trigger">Right-click me!</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Test Item</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    expect(getByTestId('trigger')).toBeInTheDocument();
  });
});
