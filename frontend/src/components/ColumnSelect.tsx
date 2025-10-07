import React from 'react';

interface ColumnSelectProps {
  columns: string[];
  xKey?: string;
  yKey?: string;
  onXChange: (column: string) => void;
  onYChange: (column: string) => void;
  disabled?: boolean;
}

export const ColumnSelect: React.FC<ColumnSelectProps> = ({
  columns,
  xKey,
  yKey,
  onXChange,
  onYChange,
  disabled
}) => {
  return (
    <div className="column-select">
      <label className="axis-select">
        <span>X Axis</span>
        <select 
          value={xKey} 
          onChange={e => onXChange(e.target.value)}
          disabled={disabled || !columns.length}
        >
          {!columns.length && <option value="">No columns available</option>}
          {columns.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <label className="axis-select">
        <span>Y Axis</span>
        <select 
          value={yKey} 
          onChange={e => onYChange(e.target.value)}
          disabled={disabled || !columns.length}
        >
          {!columns.length && <option value="">No columns available</option>}
          {columns.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
    </div>
  );
};
