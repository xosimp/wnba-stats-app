import React from 'react';
import { ProjectionResult } from '../../lib/algorithms/Algorithms';

interface AssistsProjectionResultsProps {
  projection: ProjectionResult;
  isLoading?: boolean;
}

export const AssistsProjectionResults: React.FC<AssistsProjectionResultsProps> = ({
  projection,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        <span className="ml-2 text-gray-600">Calculating assists projection...</span>
      </div>
    );
  }

  if (!projection) {
    return (
      <div className="text-center p-8 text-gray-500">
        No assists projection available
      </div>
    );
  }

  const assistsSpecific = (projection as any).assistsSpecific;
  const edge = projection.edge || 0;
  const confidenceScore = projection.confidenceScore || 0;

  // Determine edge color and text
  const getEdgeColor = (edge: number) => {
    if (Math.abs(edge) < 0.5) return 'text-gray-500';
    return edge > 0 ? 'text-green-600' : 'text-red-600';
  };

  const getEdgeText = (edge: number) => {
    if (Math.abs(edge) < 0.5) return 'NEUTRAL';
    return edge > 0 ? `+${edge.toFixed(1)}` : `${edge.toFixed(1)}`;
  };

  // Determine confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Determine risk color
  const getRiskColor = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'LOW': return 'text-green-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'HIGH': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="text-center border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">Assists Projection</h2>
        <p className="text-gray-600 mt-1">Advanced analysis with position-specific factors</p>
      </div>

      {/* Main Projection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Projected Value */}
        <div className="text-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Projected Assists</h3>
          <div className="text-3xl font-bold text-blue-600">
            {projection.projectedValue?.toFixed(1) || 'N/A'}
          </div>
          {(projection as any).sportsbookLine && (
            <div className="text-sm text-gray-500 mt-1">
              Line: {(projection as any).sportsbookLine}
            </div>
          )}
        </div>

        {/* Edge */}
        <div className="text-center bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Edge</h3>
          <div className={`text-3xl font-bold ${getEdgeColor(edge)}`}>
            {getEdgeText(edge)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            vs Sportsbook
          </div>
        </div>

        {/* Confidence */}
        <div className="text-center bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Confidence</h3>
          <div className={`text-3xl font-bold ${getConfidenceColor(confidenceScore)}`}>
            {Math.round(confidenceScore * 100)}%
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Data Quality
          </div>
        </div>
      </div>

      {/* Assists-Specific Metrics */}
      {assistsSpecific && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Assists Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {assistsSpecific.primaryAssists || 0}
              </div>
              <div className="text-sm text-gray-600">Primary Assists</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {assistsSpecific.secondaryAssists || 0}
              </div>
              <div className="text-sm text-gray-600">Secondary Assists</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {(assistsSpecific.assistEfficiency * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Assist Efficiency</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {assistsSpecific.assistRatio?.toFixed(3) || 'N/A'}
              </div>
              <div className="text-sm text-gray-600">Assist Ratio</div>
            </div>
          </div>
        </div>
      )}

      {/* Position & Matchup Analysis */}
      {assistsSpecific && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Position Analysis</h4>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              assistsSpecific.positionAdvantage === 'Favorable' ? 'bg-green-100 text-green-800' :
              assistsSpecific.positionAdvantage === 'Unfavorable' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {assistsSpecific.positionAdvantage} Position
            </div>
            <div className="text-sm text-gray-600 mt-2">
              Factor: {(projection.factors?.perFactor || 1).toFixed(2)}x
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Matchup Strength</h4>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              assistsSpecific.matchupStrength === 'Favorable' ? 'bg-green-100 text-green-800' :
              assistsSpecific.matchupStrength === 'Unfavorable' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {assistsSpecific.matchupStrength}
            </div>
            <div className="text-sm text-gray-600 mt-2">
              Defense Factor: {(projection.factors?.opponentDefense || 1).toFixed(2)}x
            </div>
          </div>
        </div>
      )}

      {/* Key Factors */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Key Adjustment Factors</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-600">
              {(projection.factors?.pace || 1).toFixed(2)}x
            </div>
            <div className="text-sm text-gray-600">Pace Factor</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600">
              {(projection.factors?.homeAway || 1).toFixed(2)}x
            </div>
            <div className="text-sm text-gray-600">Home/Away</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-600">
              {(projection.factors?.injuryImpact || 1).toFixed(2)}x
            </div>
            <div className="text-sm text-gray-600">Injury Impact</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-orange-600">
              {(projection.factors?.backToBack || 1).toFixed(2)}x
            </div>
            <div className="text-sm text-gray-600">Back-to-Back</div>
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Risk Assessment</h3>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-600">Risk Level: </span>
            <span className={`font-semibold ${getRiskColor(projection.riskLevel)}`}>
              {projection.riskLevel || 'MEDIUM'}
            </span>
          </div>
          <div>
            <span className="text-sm text-gray-600">Games Analyzed: </span>
            <span className="font-semibold text-blue-600">
              {projection.seasonGamesCount || 0}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <span className="text-sm text-gray-600">Historical Accuracy: </span>
          <span className="font-semibold text-green-600">
            {projection.historicalAccuracy || 0}%
          </span>
        </div>
      </div>

      {/* Betting Recommendation */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 text-center">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Betting Recommendation</h3>
        <div className={`text-2xl font-bold ${
          projection.recommendation === 'OVER' ? 'text-green-600' :
          projection.recommendation === 'UNDER' ? 'text-red-600' :
          'text-gray-600'
        }`}>
          {projection.recommendation || 'PASS'}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Based on {Math.round(confidenceScore * 100)}% confidence and {Math.abs(edge).toFixed(1)} assist edge
        </p>
      </div>

      {/* Advanced Metrics */}
      {assistsSpecific && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Advanced Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {(assistsSpecific.usageFactor || 1).toFixed(2)}x
              </div>
              <div className="text-sm text-gray-600">Usage Factor</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {(assistsSpecific.teammateShootingFactor || 1).toFixed(2)}x
              </div>
              <div className="text-sm text-gray-600">Teammate Shooting</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600">
                {(assistsSpecific.teamSchemeFactor || 1).toFixed(2)}x
              </div>
              <div className="text-sm text-gray-600">Team Scheme</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
