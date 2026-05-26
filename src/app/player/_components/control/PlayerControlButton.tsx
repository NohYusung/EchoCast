'use client';

import React from 'react';
import PlayButton from './PlayButton';
import PauseButton from '@/app/player/_components/control/PauseButton';
import styles from './PlayerControlButton.module.scss';

interface PlayerControlButtonProps {
  isPlaying: boolean;
  calculatedWidth?: number | string;
  onHandlePlay: () => void;
  onHandlePause: () => void;
}

const PlayerControlButton: React.FC<PlayerControlButtonProps> = ({
  isPlaying = false,
  calculatedWidth = '',
  onHandlePlay,
  onHandlePause,
}) => {
  const maxWidth = typeof calculatedWidth === 'number' ? calculatedWidth : parseInt(calculatedWidth as string) || 0;

  return (
    <div
      className={styles.playControlArea}
      style={{ maxWidth: maxWidth > 0 ? `${maxWidth}px` : undefined }}
    >
      <div className={styles.playButton}>
        {isPlaying ? (
          <PauseButton onHandleClick={onHandlePause} />
        ) : (
          <PlayButton onHandleClick={onHandlePlay} />
        )}
      </div>
    </div>
  );
};

export default PlayerControlButton;
