import React from 'react';

export function Select({ options, value, onChange, ...props }: { options: { value: string; label: string }[]; value?: string; onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} value={value} onChange={onChange} className="border rounded px-2 py-1">
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
} 