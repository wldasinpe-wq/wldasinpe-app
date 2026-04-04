type StepHeaderProps = {
  title: string;
  description: string;
  className?: string;
};

export const StepHeader = ({ title, description, className }: StepHeaderProps) => {
  return (
    <div className={`flex flex-col gap-3 text-center px-2 ${className ?? ''}`}>
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
};
