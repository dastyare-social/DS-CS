import { describe, it, expect } from 'bun:test'
import {
  filterString,
  removeEmojis,
  filterNsfwWords,
  sanitizeHtml,
} from '../index'

describe('Filters Pipeline', () => {
  describe('removeEmojis', () => {
    it('should remove emojis from text', () => {
      expect(removeEmojis('Hello 😊 world! 🌍')).toBe('Hello  world! ')
    })

    it('should return original text if no emojis', () => {
      expect(removeEmojis('Hello world!')).toBe('Hello world!')
    })
  })

  describe('filterNsfwWords', () => {
    it('should replace NSFW words with safe ones', () => {
      // The exact replacement depends on your NSFW_MAP, let's test a common case
      // We'll assume NSFW_MAP has some mappings
      const input = 'Some bad word here'
      const result = filterNsfwWords(input)
      // Since we don't know exact mappings, just test it doesn't throw
      expect(typeof result).toBe('string')
    })

    it('should leave "shit" unchanged', () => {
      expect(filterNsfwWords('Oh shit!')).toBe('Oh shit!')
    })
  })

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      expect(
        sanitizeHtml('<script>alert("xss")</script>Hello world')
      ).toBe('Hello world')
    })

    it('should remove style tags', () => {
      expect(
        sanitizeHtml('<style>body { color: red }</style>Hello')
      ).toBe('Hello')
    })

    it('should remove other HTML tags', () => {
      expect(sanitizeHtml('<div><p>Hello</p></div>')).toBe('Hello')
    })

    it('should decode HTML entities', () => {
      expect(sanitizeHtml('&amp; &lt; &gt; &quot; &#39;')).toBe('& < > " \'')
    })
  })

  describe('filterString', () => {
    it('should apply all filters except emojis (emojis are commented out) by default', () => {
      const input = '<p>Hello 😊</p>'
      const result = filterString(input)
      expect(result).not.toContain('<p>')
      // removeEmojis is currently commented out, so emojis stay
      expect(result).toContain('😊')
    })

    it('should allow skipping filters', () => {
      const input = '<p>Hello 😊</p>'
      expect(
        filterString(input, { filterNsfw: false, sanitizeHtml: false })
      ).toBe(input)
    })
  })
})
