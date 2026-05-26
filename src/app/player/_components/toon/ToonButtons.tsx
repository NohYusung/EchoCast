'use client';

import React, { useMemo } from 'react';
import styles from './ToonButtons.module.scss';
import { toonButtonIcons, type ToonButtonIconName } from '../../playerIcons';

// 사용 가능한 버튼 이름 타입을 정의합니다.
export type ButtonName = 'play' | 'pause' | 'play_all' | 'change_voice_artist' | 'review';

type ToonButtonIconSrc = (typeof toonButtonIcons)[ToonButtonIconName];

interface ButtonInfo {
  name: ButtonName;
  icon_name: string;
  tooltip: string;
  src: ToonButtonIconSrc;
}

// 버튼 메타데이터를 컴포넌트 외부에 상수로 정의하여 불필요한 재생성을 방지합니다.
const BUTTON_METADATA: Omit<ButtonInfo, 'src'>[] = [
  {
    name: 'play',
    icon_name: 'icon_play',
    tooltip: '재생',
  },
  {
    name: 'pause',
    icon_name: 'icon_play_pause',
    tooltip: '일시정지',
  },
  {
    name: 'play_all',
    icon_name: 'icon_play',
    tooltip: '전체 재생',
  },
  {
    name: 'change_voice_artist',
    icon_name: 'icon_voice_artist',
    tooltip: '캐릭터 선택',
  },
  {
    name: 'review',
    icon_name: 'icon_review',
    tooltip: '리뷰',
  },
];

interface ToonButtonsProps {
  buttons: ButtonName[];
  onClick: (buttonName: ButtonName) => void;
  layout?: 'float' | 'center';
}

const ToonButtons: React.FC<ToonButtonsProps> = ({ buttons, onClick, layout = 'float' }) => {
  // Vue의 computed 속성과 동일한 역할을 하도록 useMemo를 사용합니다.
  // buttons prop이 변경될 때만 버튼 목록을 다시 계산합니다.
  const buttonList = useMemo(() => {
    return buttons.map((name) => {
      const info = BUTTON_METADATA.find((b) => b.name === name);
      if (!info) {
        console.warn(`[ToonButtons] "${name}"에 대한 버튼 정보를 찾을 수 없습니다.`);
        return null;
      }
      return {
        ...info,
        src: toonButtonIcons[info.icon_name as ToonButtonIconName],
      };
    }).filter((b): b is ButtonInfo => b !== null); // 찾지 못한 버튼은 렌더링에서 제외
  }, [buttons]);

  const layoutClass = layout === 'center' ? styles.toolbarButtonsCenter : styles.toolbarButtonsFloat;

  return (
    <div className={layoutClass}>
      {buttonList.map((button) => (
        <div
          key={button.name}
          className={styles.toolbarButton}
          onClick={() => onClick(button.name)}
          title={button.tooltip} // q-tooltip을 간단한 title 속성으로 대체
        >
          <img src={button.src} alt={button.tooltip} />
        </div>
      ))}
    </div>
  );
};

export default ToonButtons;
