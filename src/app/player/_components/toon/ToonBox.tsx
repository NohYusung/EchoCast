'use client';

import React, { useRef, useState, useImperativeHandle, forwardRef, ReactNode } from 'react';
import styles from './ToonBox.module.scss';

interface ToonBoxProps {
  children: ReactNode;
  onTouchStart?: () => void;
  onTouchMove?: () => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
}

export interface ToonBoxRef {
  getScrollY: () => number;
  getScrollableElement: () => HTMLDivElement | null;
}

const ToonBox = forwardRef<ToonBoxRef, ToonBoxProps>(({ children, onTouchStart, onTouchMove, onScroll, style }, ref) => {
  const scrollableContentRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollY(event.currentTarget.scrollTop);
    if (onScroll) {
      onScroll(event);
    }
  };

  // Vue 컴포넌트의 emit('touch-start')에 해당하는 핸들러
  const handleInteractionStart = () => {
    if (onTouchStart) {
      onTouchStart();
    }
  };

  // Vue 컴포넌트의 emit('touch-move')에 해당하는 핸들러
  const handleInteractionMove = () => {
    if (onTouchMove) {
      onTouchMove();
    }
  };

  // 부모 컴포넌트에서 ref를 통해 호출할 수 있는 함수들을 정의합니다.
  useImperativeHandle(ref, () => ({
    getScrollY: () => scrollY,
    getScrollableElement: () => scrollableContentRef.current,
  }));

  return (
    <div className={styles.toonBox} style={style}>
      <div
        className={`${styles.toonContent} toon-scroll-layer`}
        ref={scrollableContentRef}
        onScroll={handleScroll}
        onMouseDown={handleInteractionStart}
        onTouchStart={handleInteractionStart}
        onWheel={handleInteractionStart} // mousewheel은 onWheel로 대체
        onTouchMove={handleInteractionMove}
      >
        {children}
      </div>
    </div>
  );
});

ToonBox.displayName = 'ToonBox';

export default ToonBox;
