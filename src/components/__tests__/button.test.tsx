import { describe, it, expect, beforeEach } from 'bun:test'
import { render } from '@testing-library/react'
import { Button } from '../button'
import React from 'react'
import '@testing-library/jest-dom/vitest'

// Set up happy-dom as test environment
import { Window } from 'happy-dom'

beforeEach(() => {
  const window = new Window()
  globalThis.window = window as any
  globalThis.document = window.document as any
  globalThis.navigator = window.navigator as any
  // Make sure to reset the body
  document.body.innerHTML = ''
})

describe('Button Component', () => {

  it('renders with primary variant by default', () => {
    const { container, getByText } = render(<Button>Click me</Button>)
    const button = getByText('Click me')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('data-variant', 'primary')
  })

  it('renders with secondary variant when specified', () => {
    const { getByText } = render(<Button variant="secondary">Click me</Button>)
    const button = getByText('Click me')
    expect(button).toHaveAttribute('data-variant', 'secondary')
  })

  it('is disabled when disabled prop is passed', () => {
    const { getByText } = render(<Button disabled>Click me</Button>)
    const button = getByText('Click me')
    expect(button).toBeDisabled()
  })

  it('forwards props to the button element', () => {
    const { getByText } = render(<Button id="test-button" type="submit">Submit</Button>)
    const button = getByText('Submit')
    expect(button).toHaveAttribute('id', 'test-button')
    expect(button).toHaveAttribute('type', 'submit')
  })
})
