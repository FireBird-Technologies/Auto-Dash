import React from 'react';

interface WorkflowStepProps {
  number: string;
  title: string;
  description: string;
  details: string[];
}

export const WorkflowStep: React.FC<WorkflowStepProps> = ({ number, title, description, details }) => {
  return (
    <div className="workflow-step">
      <div className="workflow-number">{number}</div>
      <div className="workflow-content">
        <h3 className="workflow-title">{title}</h3>
        <p className="workflow-description">{description}</p>
        <ul className="workflow-details">
          {details.map((detail, idx) => (
            <li key={idx}>{detail}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
