'use client';

import React from 'react';

interface PlayerBackDropProps {
  onClosePanel: () => void;
}

const PlayerBackDrop: React.FC<PlayerBackDropProps> = ({ onClosePanel }) => {
  return (
    <>
      <div
        className="backdropArea"
        onClick={onClosePanel}
        aria-hidden="true"
      />
      <style jsx>{`
          .backdropArea {
              width: 100%;
              height: 100%;
              position: fixed;
              inset: 0;
              background: rgba(0, 0, 0, 0.45);
          }
      `}</style>
    </>

  );
};

export default PlayerBackDrop;
