import React from 'react';

export type Step = {
  key: string;
  title: string;
  description: string;
};

interface StepWizardProps {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
}

export const StepWizard: React.FC<StepWizardProps> = ({
  steps,
  currentStep,
  onStepChange,
}) => {
  return (
    <div className="step-wizard">
      <div className="steps">
        {steps.map((step, index) => (
          <div
            key={step.key}
            className={`step ${index === currentStep ? 'active' : ''} 
                       ${index < currentStep ? 'completed' : ''}`}
            onClick={() => index < currentStep && onStepChange(index)}
          >
            <div className="step-number">
              {index < currentStep ? 'done' : index + 1}
            </div>
            <div className="step-content">
              <div className="step-title">{step.title}</div>
              <div className="step-description">{step.description}</div>
            </div>
            {index < steps.length - 1 && <div className="step-connector" />}
          </div>
        ))}
      </div>
    </div>
  );
};
