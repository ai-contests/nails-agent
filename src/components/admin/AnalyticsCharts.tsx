'use client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';

interface AnalyticsChartsProps {
  styleHeat: any[];
  tagHeat: any[];
  labels: {
    chartStyleHeat: string;
    chartTagTrend: string;
    chartHeatScore: string;
    chartGrowthRate: string;
    chartHeatIndex: string;
  };
}

export function AnalyticsCharts({ styleHeat, tagHeat, labels }: AnalyticsChartsProps) {
  // Format data for style heat
  const styleData = styleHeat
    .sort((a, b) => b.heat_score - a.heat_score)
    .slice(0, 10)
    .map(item => ({
      name: item.style_id?.slice(0, 8) || 'Unknown',
      heat: Math.round(item.heat_score * 100),
      growth: Math.round((item.growth_score || 0) * 100)
    }));

  // Format data for tag heat
  const tagData = tagHeat
    .sort((a, b) => b.heat_score - a.heat_score)
    .slice(0, 10)
    .map(item => ({
      name: item.tag_value,
      heat: Math.round(item.heat_score * 100)
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 mb-8">
      {/* Style Heat Chart */}
      <div className="bg-surface-dark border border-border-dark rounded-card p-4">
        <h3 className="text-xs font-semibold text-text-dark-primary mb-4 tracking-wide">
          {labels.chartStyleHeat.toUpperCase()}
        </h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={styleData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#808080' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#808080' }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333333', fontSize: '12px', color: '#E0E0E0' }}
                itemStyle={{ color: '#E0E0E0' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="heat" name={labels.chartHeatScore} fill="#4B90E2" radius={[4, 4, 0, 0]} />
              <Bar dataKey="growth" name={labels.chartGrowthRate} fill="#50E3C2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tag Trends Chart */}
      <div className="bg-surface-dark border border-border-dark rounded-card p-4">
        <h3 className="text-xs font-semibold text-text-dark-primary mb-4 tracking-wide">
          {labels.chartTagTrend.toUpperCase()}
        </h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tagData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#808080' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#808080' }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333333', fontSize: '12px', color: '#E0E0E0' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="heat" name={labels.chartHeatIndex} stroke="#F5A623" strokeWidth={3} dot={{ r: 4, fill: '#F5A623' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
