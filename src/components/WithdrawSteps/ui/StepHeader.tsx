import { twMerge } from 'tailwind-merge';

type StepHeaderProps = {
  title: string;
  description?: string;
  className?: string;
  /** Tighter typography for dense flows (e.g. amount + numpad). */
  compact?: boolean;
};

export const StepHeader = ({
  title,
  description,
  className,
  compact = false,
}: StepHeaderProps) => {
  return (
    <div
      className={twMerge(
        'flex flex-col text-center px-2',
        compact ? 'gap-1' : 'gap-3',
        className,
      )}
    >
      <h1
        className={
          compact
            ? 'text-lg font-bold text-gray-900 tracking-tight'
            : 'text-2xl font-bold text-gray-900 tracking-tight'
        }
      >
        {title}
      </h1>
      {description ? (
        <p
          className={
            compact
              ? 'text-xs text-gray-600 leading-snug'
              : 'text-sm text-gray-600 leading-relaxed'
          }
        >
          {description}
        </p>
      ) : null}
    </div>
  );
};
