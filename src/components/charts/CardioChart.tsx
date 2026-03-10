import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../common/Card';
import {
  type DayCardioMetrics,
  getCardioZoneColor,
  getCardioZoneLabel,
} from '../../utils/metricsCalculations';

interface CardioChartProps {
  cardioMetrics: DayCardioMetrics[];
}

interface ChartDataItem {
  name: string;
  zone1_2: number;
  zone3: number;
  zone4_5: number;
  total: number;
}

export function CardioChart({ cardioMetrics }: CardioChartProps) {
  // Check if there's any cardio data
  const hasCardioData = cardioMetrics.some((day) => day.totalMinutes > 0);

  if (!hasCardioData) {
    return (
      <Card>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Cardio Summary</h4>
        <div className="h-32 flex items-center justify-center">
          <p className="text-sm text-gray-400">No cardio exercises this week</p>
        </div>
      </Card>
    );
  }

  // Transform data for stacked bar chart
  const chartData: ChartDataItem[] = cardioMetrics.map((day) => {
    let zone1_2 = 0;
    let zone3 = 0;
    let zone4_5 = 0;

    day.byZone.forEach((z) => {
      if (z.zone <= 2) {
        zone1_2 += z.minutes;
      } else if (z.zone === 3) {
        zone3 += z.minutes;
      } else {
        zone4_5 += z.minutes;
      }
    });

    return {
      name: day.dayName.length > 10 ? `D${day.dayNumber}` : day.dayName,
      zone1_2,
      zone3,
      zone4_5,
      total: day.totalMinutes,
    };
  });

  // Calculate max for Y axis
  const maxMinutes = Math.max(...chartData.map((d) => d.total), 60);

  return (
    <Card>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Cardio Summary</h4>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickLine={false}
              domain={[0, maxMinutes]}
              label={{ value: 'min', angle: -90, position: 'insideLeft', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  zone1_2: `${getCardioZoneLabel(1)}/${getCardioZoneLabel(2)}`,
                  zone3: getCardioZoneLabel(3),
                  zone4_5: `${getCardioZoneLabel(4)}/${getCardioZoneLabel(5)}`,
                };
                return [`${value} min`, labels[name] || name];
              }}
            />
            <Bar
              dataKey="zone1_2"
              stackId="cardio"
              fill={getCardioZoneColor(1)}
              radius={[0, 0, 0, 0]}
              name="zone1_2"
            />
            <Bar
              dataKey="zone3"
              stackId="cardio"
              fill={getCardioZoneColor(3)}
              radius={[0, 0, 0, 0]}
              name="zone3"
            />
            <Bar
              dataKey="zone4_5"
              stackId="cardio"
              fill={getCardioZoneColor(5)}
              radius={[4, 4, 0, 0]}
              name="zone4_5"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-3 mt-2 flex-wrap">
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getCardioZoneColor(1) }}
          ></div>
          <span className="text-xs text-gray-500">Low (Z1-2)</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getCardioZoneColor(3) }}
          ></div>
          <span className="text-xs text-gray-500">Moderate (Z3)</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getCardioZoneColor(5) }}
          ></div>
          <span className="text-xs text-gray-500">High (Z4-5)</span>
        </div>
      </div>
    </Card>
  );
}
