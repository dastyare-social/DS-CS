import { describe, it, expect } from 'bun:test'
import { inferStoryTypeFromMime } from '../mutations'

describe('Stories API - Mutations', () => {
  describe('inferStoryTypeFromMime', () => {
    it('should return "image" for null/undefined', () => {
      expect(inferStoryTypeFromMime(null)).toBe('image')
    })

    it('should return "image" for image MIME types', () => {
      expect(inferStoryTypeFromMime('image/png')).toBe('image')
      expect(inferStoryTypeFromMime('image/jpeg')).toBe('image')
    })

    it('should return "video" for video MIME types', () => {
      expect(inferStoryTypeFromMime('video/mp4')).toBe('video')
      expect(inferStoryTypeFromMime('video/webm')).toBe('video')
    })

    it('should return "image" for other MIME types', () => {
      expect(inferStoryTypeFromMime('application/pdf')).toBe('image')
      expect(inferStoryTypeFromMime('text/plain')).toBe('image')
    })
  })
})
