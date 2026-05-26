'use client';

import React from 'react';
import { playerIcons } from '../../playerIcons';

interface PlayerSpeakMuteProps {
  isMuted?: boolean;
  calculatedWidth?: number | string;
  onToggleMute?: () => void;
}

const PlayerSpeakMute: React.FC<PlayerSpeakMuteProps> = ({
  isMuted = false,
  calculatedWidth = '',
  onToggleMute
}) => {
  const maxWidth = typeof calculatedWidth === 'number' ? calculatedWidth : parseInt(calculatedWidth as string) || 0;

  return (
    <>
      {(
            <div className="controlContainer" style={{ maxWidth: maxWidth > 0 ? `${maxWidth}px` : undefined }}>
            <button
              type="button"
              className="controlButton"
              onClick={onToggleMute}
              aria-label={isMuted ? '음소거 해제' : '음소거'}
            >
              <img
                src={isMuted ? playerIcons.mute : playerIcons.speakActive}
                alt={isMuted ? '음소거' : '음소거 해제'}
                width={24}
                height={24}
                className="icon"
              />
            </button>
          </div>
      )}
      <style jsx>{`
          .controlContainer {
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
          }

          .controlButton {
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              padding: 0;
              transition: all 0.2s;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

              &:hover {
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              }

              &:active {
                  transform: scale(0.95);
              }
          }

          .icon {
              width: 40px;
              height: 40px;
              color: #666;

              @media (max-width: 768px) {
                width: 32px;
                height: 32px;
              }
          }
      `}</style>
    </>
  );
};

export default PlayerSpeakMute;
