import { describe, it, expect, beforeEach } from 'bun:test';
import { render } from '@testing-library/react';
import { Input } from '../input';
import React from 'react';
import { Window } from 'happy-dom';

beforeEach(() => {
  const window = new Window();
  globalThis.window = window as any;
  globalThis.document = window.document as any;
  globalThis.navigator = window.navigator as any;
  document.body.innerHTML = '';
});

describe('Input Component', () => {
  it('renders input with correct data-slot attribute', () => {
    const { getByPlaceholderText } = render(<Input placeholder="Enter text" />);
    const input = getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('data-slot', 'input');
  });

  it('forwards native input props', () => {
    const { getByPlaceholderText } = render(<Input type="email" id="test-email" placeholder="Email" />);
    const input = getByPlaceholderText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('id', 'test-email');
  });
});
