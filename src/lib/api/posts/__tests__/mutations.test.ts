import { describe, it, expect } from 'bun:test'
import { inferPostTypeFromMime } from '../mutations'

describe('Posts API - Mutations', () => {
  describe('inferPostTypeFromMime', () => {
    it('should return "text" for null/undefined', () => {
      expect(inferPostTypeFromMime(null)).toBe('text')
    })

    it('should return "image" for image MIME types', () => {
      expect(inferPostTypeFromMime('image/png')).toBe('image')
      expect(inferPostTypeFromMime('image/jpeg')).toBe('image')
    })

    it('should return "voice" for audio MIME types', () => {
      expect(inferPostTypeFromMime('audio/mp3')).toBe('voice')
      expect(inferPostTypeFromMime('audio/wav')).toBe('voice')
    })

    it('should return "video" for video MIME types', () => {
      expect(inferPostTypeFromMime('video/mp4')).toBe('video')
      expect(inferPostTypeFromMime('video/webm')).toBe('video')
    })

    it('should return "file" for other MIME types', () => {
      expect(inferPostTypeFromMime('application/pdf')).toBe('file')
      expect(inferPostTypeFromMime('text/plain')).toBe('file')
    })
  })
})
