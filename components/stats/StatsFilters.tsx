import React from 'react';
import { Select } from '../ui/Select';

const statOptions = [
  { value: 'points', label: 'Points' },
  { value: 'rebounds', label: 'Rebounds' },
  { value: 'assists', label: 'Assists' },
];

export function StatsFilters({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-2">
      <Select
        options={statOptions}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
} 