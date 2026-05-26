'use client';

import React from 'react';

interface GrayArrowRightProps {
  color?: string;
  className?: string;
}

const GrayArrowRight: React.FC<GrayArrowRightProps> = ({ color = '#000000', className }) => {
  return (
    <svg
      width="6"
      height="10"
      viewBox="0 0 6 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M1 1L5 5L1 9" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="bevel" />
    </svg>
  );
};

export default GrayArrowRight;
