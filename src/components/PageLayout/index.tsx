import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

/**
 * This component is a simple page layout component to help with design consistency
 * Feel free to modify this component to fit your needs
 */
export const Page = (props: { children: ReactNode; className?: string }) => {
  return (
    <div className={twMerge(clsx('flex h-dvh flex-col', props.className))}>
      {props.children}
    </div>
  );
};

const Header = (props: { children: ReactNode; className?: string }) => {
  return (
    <header
      className={twMerge(
        'flex flex-col justify-center px-6 pt-6 pb-3 z-10',
        clsx(props.className),
      )}
      style={{ background: 'var(--white-ridivi)' }}
    >
      {props.children}
    </header>
  );
};

const Main = (props: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) => {
  return (
    <main
      className={twMerge(
        clsx('grow overflow-y-auto p-4', props.className),
      )}
      style={props.style}
    >
      {props.children}
    </main>
  );
};

const Footer = (props: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) => {
  return (
    <footer
      className={twMerge('px-6 pb-[35px]', clsx(props.className))}
      style={props.style}
    >
      {props.children}
    </footer>
  );
};

Page.Header = Header;
Page.Main = Main;
Page.Footer = Footer;
