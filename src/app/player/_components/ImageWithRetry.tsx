'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { usePlayerStore } from '@/stores/usePlayerStore'

interface ImageWithRetryProps {
  src: string
  alt: string
  width: number
  height: number
  sizes: string
  className?: string
  style?: React.CSSProperties
  loading?: 'eager' | 'lazy'
  priority?: boolean
  onLoad?: () => void
}

export default function ImageWithRetry({
                                         src,
                                         alt,
                                         width,
                                         height,
                                         sizes,
                                         className,
                                         style,
                                         loading,
                                         priority,
                                         onLoad
                                       }: ImageWithRetryProps) {
  const playerStore = usePlayerStore()
  const [imageError, setImageError] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [key, setKey] = useState(0)
  const [currentSrc, setCurrentSrc] = useState(src)

  // 캐시된 이미지 URL 확인
  const cachedImageUrl = playerStore.imageCache?.get(src)

  // 사용할 이미지 URL 결정
  useEffect(() => {
    if (cachedImageUrl) {
      console.log('[ImageWithRetry] 캐시된 URL 사용:', src.substring(0, 50))
      setCurrentSrc(cachedImageUrl)
    } else {
      console.log('[ImageWithRetry] 원본 URL 사용:', src.substring(0, 50))
      setCurrentSrc(src)
    }
  }, [cachedImageUrl, src])

  const handleRetry = async () => {
    console.log('[ImageWithRetry] 재시도 시작:', src.substring(0, 50))
    setRetrying(true)
    setImageError(false)

    try {
      // 캐시와 상태 초기화
      const imageCache = playerStore.imageCache
      const imageLoadingStatus = playerStore.imageLoadingStatus

      if (imageCache) imageCache.delete(src)
      if (imageLoadingStatus) imageLoadingStatus.delete(src)

      // key를 변경하여 Image 컴포넌트 강제 리렌더링
      setKey(prev => prev + 1)

      // 재다운로드 시도
      const result = await playerStore.downloadImage(src)
      console.log('[ImageWithRetry] 재다운로드 결과:', result ? '성공' : '실패')

      if (!result) {
        setImageError(true)
      }
    } catch (error) {
      console.error('[ImageWithRetry] 재시도 실패:', error)
      setImageError(true)
    } finally {
      setRetrying(false)
    }
  }

  const handleImageLoad = () => {
    console.log('[ImageWithRetry] 이미지 로드 성공:', src.substring(0, 50))
    setImageError(false)
    if (onLoad) onLoad()
  }

  const handleImageError = () => {
    console.error('[ImageWithRetry] 이미지 로드 실패:', src.substring(0, 50))
    setImageError(true)
  }

  if (imageError) {
    return (
      <div
        className="image-error-container"
        style={{
          width: '100%',
          height: 'auto',
          aspectRatio: `${width} / ${height}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          position: 'relative',
        }}
      >
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="retry-button"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: '#ffffff',
            cursor: retrying ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!retrying) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              fontSize: '28px',
              lineHeight: 1,
              animation: retrying ? 'spin 1s linear infinite' : 'none',
            }}
          >
            ↻
          </span>
          <span style={{ fontSize: '14px', fontWeight: '500' }}>
            {retrying ? '로딩 중...' : '이미지 새로고침'}
          </span>
        </button>

        <style jsx>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <Image
      key={`${src}-${key}`}
      src={currentSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      sizes={sizes}
      style={style}
      loading={loading}
      priority={priority}
      onLoad={handleImageLoad}
      onError={handleImageError}
    />
  )
}
