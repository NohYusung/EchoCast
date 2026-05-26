/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './PlayerLoadingbar.module.scss';

interface PlayerLoadingbarProps {
  loading?: boolean;
  loadingCount?: number;
  progress?: number | null;
  message?: string;
  fullscreen?: boolean;
  zIndex?: number;
  minDurationMs?: number;
}

const PlayerLoadingbar: React.FC<PlayerLoadingbarProps> = ({
  loading = false,
  loadingCount = 0,
  progress: _progress = null, // 항상 회전하는 스피너를 사용하므로 진행률 무시
  message = '로딩 중...',
  fullscreen = true,
  zIndex = 2000,
  minDurationMs = 500
}) => {
  void _progress; // 사용하지 않는 파라미터 경고 제거
  const [visible, setVisible] = useState(false);
  const startAtRef = useRef(0);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isActive = loading || loadingCount > 0;

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (isActive) {
      clearHideTimer();
      setVisible(true);
      startAtRef.current = Date.now();
    } else {
      const elapsed = Date.now() - startAtRef.current;
      const remain = minDurationMs - elapsed;
      if (remain <= 0) {
        setVisible(false);
      } else {
        clearHideTimer();
        hideTimerRef.current = setTimeout(() => {
          setVisible(false);
          hideTimerRef.current = null;
        }, remain);
      }
    }

    return () => {
      clearHideTimer();
    };
  }, [isActive, minDurationMs]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.loadingWrapper} ${fullscreen ? styles.isFullscreen : ''} ${styles.fadeLoading}`}
      style={{ zIndex }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={styles.loadingOverlay} aria-hidden="true" />

      <div className={styles.loadingCenter}>
        {/* 항상 회전하는 스피너 표시 (진행률 바 제거) */}
        <div className={styles.loadingProgress}>
          <svg viewBox="0 0 135 135" className={`${styles.circularProgress} ${styles.indeterminate}`}>
            <circle
              cx="67.5"
              cy="67.5"
              r="54"
              fill="none"
              stroke="white"
              strokeWidth="10.8"
              strokeDasharray="84.82 254.47"
              strokeLinecap="round"
            />
          </svg>
        </div>
        {/* 텍스트를 스피너 바깥(아래)으로 분리 */}
        <div className={styles.loadingText}>
          <svg viewBox="0 0 24 24" fill="white" className={styles.iconSpeaker}>
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
          <div>{message}</div>
        </div>
      </div>
    </div>
  );
};

export default PlayerLoadingbar;
