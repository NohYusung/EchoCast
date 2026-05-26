'use client';

import React from 'react';
import styles from './PlayerBottomMenu.module.scss';
import { playerIcons } from '../playerIcons';

interface PlayerBottomMenuProps {
  isHidden?: boolean;
  isAutoPlay?: boolean;
  isEpisodeListOpen?: boolean;
  isOpenDialog?: boolean;
  onClickNext: () => void;
  onClickPrev: () => void;
  onClickEpisodes: () => void;
  onClickCasting: () => void;
  onClickAutoPlay: (isOn: boolean) => void;
}

const PlayerBottomMenu: React.FC<PlayerBottomMenuProps> = ({
  isHidden = false,
  isAutoPlay = false,
  isEpisodeListOpen = false,
  isOpenDialog = false,
  onClickNext,
  onClickPrev,
  onClickEpisodes,
  onClickCasting,
  onClickAutoPlay,
}) => {
  const listIcon = isEpisodeListOpen
    ? playerIcons.listActive
    : playerIcons.thumbnail;

  // 다이얼로그가 열려있거나 정주행 모드가 켜져있으면 활성화
  const isAutoPlayActive = isAutoPlay || isOpenDialog;

  return (
    <div className={styles.playerBottomMenu}>
      <div className={styles.playerButtonArea}>
        <div className={styles.leftInfo}>
          <button
            type="button"
            className={`${styles.infoButton}`}
            onClick={() => {
              onClickCasting();
            }}
          >
            <img className={`${styles.iconMove}`} src={playerIcons.muticasting} alt="멀티캐스팅" />
            <span className={styles.leftBottomText}>마이캐스팅</span>
          </button>
          <button
            type="button"
            className={`${styles.infoButton} ${isAutoPlayActive ? styles.activeInfoButton : ''}`}
            onClick={() => {
              const isOn = !isAutoPlay;
              onClickAutoPlay(isOn);
            }}
          >
            <img
              className={`${styles.iconMove} ${isAutoPlayActive ? styles.iconActive : ''}`}
              src={isAutoPlayActive ? playerIcons.startOnActive : playerIcons.startOn}
              alt="정주행 on"
            />
            <span className={styles.leftBottomText}>정주행 on</span>
          </button>
        </div>

        {!isHidden && (
          <div className={styles.playerControl}>
            <button
              type="button"
              className={styles.controlButton}
              onClick={onClickPrev}
            >
              <img className={styles.iconMove} src={playerIcons.prev} alt="이전" />
              <span className={styles.mobileText}>이전화</span>
            </button>
            <div className={styles.boundary}>
              <span className={styles.mobileText}>l</span>
            </div>
            <button
              type="button"
              className={styles.controlButton}
              onClick={onClickEpisodes}
            >
              <img className={styles.icon} src={listIcon} alt="목록" />
              <span className={styles.mobileText}>목록</span>
            </button>
             <div className={styles.boundary}>
              <span className={styles.mobileText}>l</span>
            </div>
            <button
              type="button"
              className={styles.controlButton}
              onClick={onClickNext}
            >
              <span className={styles.mobileText}>다음화</span>
              <img className={styles.iconMove} src={playerIcons.next} alt="다음" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerBottomMenu;
