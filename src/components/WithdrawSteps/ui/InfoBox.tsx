import type { ReactNode } from 'react';

type InfoBoxProps = {
  children: ReactNode;
  className?: string;
};

export const InfoBox = ({ children, className }: InfoBoxProps) => {
  return (
    <div className={`bg-gray-100 border border-gray-300 p-5 ${className ?? ''}`}>
      {children}
    </div>
  );
};
