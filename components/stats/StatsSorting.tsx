import React from 'react';
import { Select } from '../ui/Select';

const sortOptions = [
  { value: 'date', label: 'Date' },
  { value: 'stat', label: 'Stat Value' },
];

export function StatsSorting({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-2">
      <Select
        options={sortOptions}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
} 