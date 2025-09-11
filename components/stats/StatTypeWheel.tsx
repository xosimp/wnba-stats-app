'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

export type StatType = 'PTS' | 'REB' | 'AST' | 'PA' | 'PRA' | 'PR' | 'FGA' | '3PA' | 'FTA';

interface StatTypeWheelProps {
  selectedStatType: StatType;
  onStatTypeSelect: (statType: StatType) => void;
}

const statTypes: StatType[] = ['PTS', 'REB', 'AST', 'PA', 'PRA', 'PR', 'FGA', '3PA', 'FTA'];

export function StatTypeWheel({ selectedStatType, onStatTypeSelect }: StatTypeWheelProps) {
  return (
    <div className="flex justify-center" style={{ marginTop: '25px' }}>
      <div 
        className="flex space-x-3 overflow-x-auto scrollbar-hide"
        style={{
          maxWidth: '400px',
          padding: '8px 16px',
          background: 'rgba(24, 27, 35, 0.8)',
          borderRadius: '20px',
          border: '2px solid #71FD08',
          boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {statTypes.map((statType, idx) => (
          <motion.button
            key={statType}
            onClick={() => onStatTypeSelect(statType)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              selectedStatType === statType
                ? ''
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors duration-150'
            }`}
            whileHover={{ scale: 1.12, border: '2px solid #71FD08' }}
            whileTap={{ scale: 0.95 }}
            style={{
              background: selectedStatType === statType ? '#71FD08' : undefined,
              color: selectedStatType === statType ? '#000' : undefined,
              fontWeight: 'bold',
              border: selectedStatType === statType ? '2px solid #71FD08' : '2px solid transparent',
              boxShadow: selectedStatType === statType 
                ? '0 4px 12px rgba(113, 253, 8, 0.4)' 
                : '0 2px 6px rgba(0,0,0,0.3)',
              marginRight: idx !== statTypes.length - 1 ? 6 : 0, // extra margin for spacing
              cursor: 'pointer',
              // No transition for scale/border, only for color
            }}
          >
            {statType}
          </motion.button>
        ))}
      </div>
    </div>
  );
} 