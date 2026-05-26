/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useRef, useImperativeHandle, forwardRef, ReactNode, useCallback } from 'react';
import styles from './BaseToonWork.module.scss';
import { playerLogger } from '@/app/player/_lib/playerLogger';

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    playerLogger.log('[BaseToonWork]', ...args);
  }
};

interface BaseToonWorkProps {
  workspace_options: any;
  calculatedWidth: number | string;
  children: ReactNode;
}

export interface BaseToonWorkRef {
  playEffect: (effect: any, result?: boolean, current_time_ms?: number) => Promise<void>;
  stopAllEffects: () => void;
}

const BaseToonWork = forwardRef<BaseToonWorkRef, BaseToonWorkProps>(
  ({ workspace_options, calculatedWidth, children }, ref) => {
    const toonOverlayRef = useRef<HTMLDivElement>(null);
    const fadeEffectRef = useRef<HTMLDivElement>(null);

    // 애니메이션 인스턴스와 상태는 re-render를 유발하지 않는 ref로 관리합니다.
    const activeEffectsRef = useRef<Animation[]>([]);
    const isEffectRunningRef = useRef(false);

    const stopAllEffects = useCallback(() => {
      isEffectRunningRef.current = false;

      activeEffectsRef.current.forEach((effect, index) => {
        try {
          effect.cancel();
          devLog(`effect ${index} cancelled`);
        } catch (error) {
          devLog(`Error cancelling effect ${index}:`, error);
        }
      });

      activeEffectsRef.current = [];

      const movable = toonOverlayRef.current;
      if (movable) {
        movable.style.transform = 'translateX(-50%)';
        devLog('Movable element reset');
      }

      const overlay = fadeEffectRef.current;
      if (overlay) {
        Object.assign(overlay.style, {
          backgroundColor: 'transparent',
          transition: 'opacity 0ms linear',
          opacity: '0',
        });
        devLog('Overlay effect removed');
      }
      devLog('All animations stopped and reset.');
    }, []);

    const playEffect = useCallback(
      async (effect: any, result = false, current_time_ms = 0) => {
        devLog('playEffect called:', effect?.params?.sub_type);

        if (!result) {
          devLog('New effect, cleaning up previous animations.');
          stopAllEffects();
          // DOM 업데이트를 기다리기 위해 마이크로태스크 큐를 사용합니다.
          await Promise.resolve();
        }

        const overlay = fadeEffectRef.current;
        const movable = toonOverlayRef.current;
        const params = effect?.params;

        if (!effect || !movable || !overlay) {
          return;
        }

        isEffectRunningRef.current = true;

        if (params?.sub_type === 'shake') {
          const shaking_count = params?.count || 10;
          const offset = (workspace_options.image_scale ?? 1) * (params?.offset || 30);
          const period = params?.period || 50;

          const runShakeCycle = async (remaining: number) => {
            if (remaining <= 0 || !isEffectRunningRef.current) return;

            try {
              const upEffect = movable.animate(
                [
                  { transform: `translateX(-50%) translateY(0px)` },
                  { transform: `translateX(-50%) translateY(-${offset}px)` },
                ],
                { duration: period, easing: 'linear', fill: 'forwards' }
              );
              activeEffectsRef.current.push(upEffect);
              await upEffect.finished;
              activeEffectsRef.current = activeEffectsRef.current.filter(e => e !== upEffect);

              if (!isEffectRunningRef.current) return;

              const downEffect = movable.animate(
                [
                  { transform: `translateX(-50%) translateY(-${offset}px)` },
                  { transform: `translateX(-50%) translateY(0px)` },
                ],
                { duration: period, easing: 'linear', fill: 'forwards' }
              );
              activeEffectsRef.current.push(downEffect);
              await downEffect.finished;
              activeEffectsRef.current = activeEffectsRef.current.filter(e => e !== downEffect);

              await runShakeCycle(remaining - 1);
            } catch (error: unknown) {
              if (error instanceof Error && error.name !== 'AbortError') {
                devLog('Shake animation error:', error);
              }
            }
          };

          await runShakeCycle(shaking_count);

        } else if (params?.sub_type === 'fade') {
          devLog('Fade effect started');
          let start_alpha = params?.start_alpha ?? 0;
          let end_alpha = params?.end_alpha ?? 100;

          start_alpha /= 100;
          end_alpha /= 100;

          if (!result) {
            Object.assign(overlay.style, {
              backgroundColor: params?.color || 'black',
              transition: 'opacity 0ms linear',
              opacity: `${start_alpha}`,
            });

            await Promise.resolve();

            if (!isEffectRunningRef.current) {
              devLog('Fade animation aborted before start.');
              return;
            }

            const fadeAnimation = overlay.animate(
              [{ opacity: start_alpha }, { opacity: end_alpha }],
              { duration: params?.duration || 1000, easing: 'linear', fill: 'forwards' }
            );

            activeEffectsRef.current.push(fadeAnimation);
            devLog('Fade animation added. Total active:', activeEffectsRef.current.length);

            try {
              await fadeAnimation.finished;
            } catch (error: unknown) {
              devLog('Fade animation interrupted:', (error instanceof Error) ? error.name : '');
            } finally {
              activeEffectsRef.current = activeEffectsRef.current.filter(e => e !== fadeAnimation);
              devLog('Fade animation removed. Remaining:', activeEffectsRef.current.length);
            }
          } else {
            const time_percent = Math.min(1, (current_time_ms - (effect.time_ms ?? 0)) / (params.duration ?? 1));
            const current_alpha = start_alpha + (end_alpha - start_alpha) * time_percent;

            Object.assign(overlay.style, {
              backgroundColor: params?.color || 'black',
              transition: 'opacity 0ms linear',
              opacity: `${current_alpha}`,
            });
          }
        }
      },
      [stopAllEffects, workspace_options.image_scale]
    );

    useImperativeHandle(ref, () => ({
      playEffect,
      stopAllEffects,
    }));

    return (
      <div
        ref={toonOverlayRef}
        id="toon-overlay"
        className={styles.toonOverlay}
        style={{ width: `${calculatedWidth}px` }}
      >
        <div style={{ margin: '0 auto', width: `${calculatedWidth}px` }}>
          {children}
          <div ref={fadeEffectRef} id="toon-overlay-fade-effect" className={styles.fadeEffect} />
        </div>
      </div>
    );
  }
);

BaseToonWork.displayName = 'BaseToonWork';

export default BaseToonWork;
