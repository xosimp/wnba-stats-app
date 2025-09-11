import React from 'react';

interface PeriodSelectorProps {
  selectedPeriod: string;
  onSelect: (period: string) => void;
  h2hPercentage: number;
  l5Percentage: number;
  l10Percentage: number;
  seasonPercentage: number;
  selectedStatType?: string;
  h2hGamesCount?: number;
}

const periodLabels = [
  { label: 'H2H', key: 'H2H' },
  { label: 'L5', key: 'L5' },
  { label: 'L10', key: 'L10' },
  { label: 'Season', key: 'Season' },
];

const getColor = (percentage: number, selectedStatType?: string) => {
  if (['FGA', '3PA', 'FTA'].includes(selectedStatType || '')) {
    return '#8B5CF6'; // Purple for FGA, 3PA, FTA
  }
  return percentage >= 50 ? '#71FD08' : '#ef4444';
};

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedPeriod,
  onSelect,
  h2hPercentage,
  l5Percentage,
  l10Percentage,
  seasonPercentage,
  selectedStatType,
  h2hGamesCount = 0,
}) => {
  const percentages = [h2hPercentage, l5Percentage, l10Percentage, seasonPercentage];
  const shouldShowNA = ['FGA', '3PA', 'FTA'].includes(selectedStatType || '');
  const shouldShowH2HNA = h2hGamesCount === 0;
  return (
    <div className="mb-2 w-full flex flex-row justify-center">
      <div className="flex flex-row justify-between items-center" style={{ width: 400 }}>
        {periodLabels.map((period, idx) => (
          <span
            key={period.key}
            className="text-[13px] font-semibold flex items-center period-btn"
            style={{
              background: '#1A1E28',
              border: selectedPeriod === period.key ? 
                (shouldShowNA ? '2px solid #8B5CF6' : '2px solid #71FD08') : 
                '1px solid #2A2F3A',
              borderRadius: 8,
              padding: '2px 10px',
              marginRight: 8,
              minWidth: 56,
              justifyContent: 'center',
              color: '#D1D5DB',
              boxShadow: selectedPeriod === period.key ? 
                (shouldShowNA ? '0 0 12px 2px #8B5CF6, 0 0 8px 2px black' : '0 0 12px 2px #71FD08, 0 0 8px 2px black') : 
                '0 0 8px 2px black',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.6, 1)',
              zIndex: 10,
              position: 'relative',
              top: -13,
            }}
            onClick={() => onSelect(period.key)}
            onMouseEnter={e => {
              if (selectedPeriod !== period.key) {
                (e.currentTarget as HTMLElement).style.border = shouldShowNA ? '2px solid #8B5CF6' : '2px solid #71FD08';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)';
              }
            }}
            onMouseLeave={e => {
              if (selectedPeriod !== period.key) {
                (e.currentTarget as HTMLElement).style.border = '1px solid #2A2F3A';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }
            }}
          >
            {period.label}
            <span style={{ color: getColor(percentages[idx], selectedStatType), marginLeft: 6, fontWeight: 700 }}>
              {shouldShowNA || (period.key === 'H2H' && shouldShowH2HNA) ? 'N/A' : `${percentages[idx]}%`}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

export { PeriodSelector }; 