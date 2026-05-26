'use client';

import React from 'react';
import { playerIcons } from '../../playerIcons';
import styles from './PlayButton.module.scss';

interface PauseButtonProps {
  onHandleClick: () => void;
  className?: string;
}

const PauseButton: React.FC<PauseButtonProps> = ({
  onHandleClick,
  className,
}) => {
  return (
    <button
      type="button"
      className={`${styles.playerButton} ${className || ''}`}
      onClick={onHandleClick}
    >
      <img className={styles.icon} src={playerIcons.pause} alt="" />
      <span className={styles.label}>일시정지</span>
    </button>
  );
};

export default PauseButton;
