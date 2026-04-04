type StepProgressProps = {
  currentStep: number;
  totalSteps?: number;
};

export const StepProgress = ({
  currentStep,
  totalSteps = 4,
}: StepProgressProps) => {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);
  return (
    <div className="flex items-center gap-2 px-2">
      {steps.map((step) => (
        <div
          key={step}
          className={`flex-1 h-1 ${step <= currentStep ? 'bg-gray-900' : 'bg-gray-300'}`}
        />
      ))}
      <span className="text-xs text-gray-500 ml-2 shrink-0">
        Paso {currentStep} de {totalSteps}
      </span>
    </div>
  );
};
