interface CostMeterProps {
  sessionCostUsd: number;
  topicTotalUsd: number;
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${(usd * 1000).toFixed(2)}m`;
  return `$${usd.toFixed(4)}`;
}

export function CostMeter({ sessionCostUsd, topicTotalUsd }: CostMeterProps) {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-400">
      <span title="Cost for this session">Session: {formatCost(sessionCostUsd)}</span>
      <span className="text-gray-200">|</span>
      <span title="Cumulative cost for this topic">Total: {formatCost(topicTotalUsd)}</span>
    </div>
  );
}
