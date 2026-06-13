'use client'
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatINR } from '@/lib/utils'

interface Props {
  weeklyData: { day: string; amt: number }[]
  weekGold: string
  collectedWeek: number
}

export default function DashboardCharts({ weeklyData, weekGold, collectedWeek }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Weekly collection */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #E5DDD0' }}>
        <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#7A6A5A', letterSpacing: '0.08em' }}>
          This Week · Daily Collection
        </div>
        <div className="font-serif font-normal text-2xl mb-4" style={{ color: '#1A1008' }}>
          {formatINR(collectedWeek)}
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart data={weeklyData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C09428" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#C09428" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: '#7A6A5A' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: number) => [formatINR(v), 'Collected']}
              contentStyle={{
                border: 'none',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="amt"
              stroke="#C09428"
              strokeWidth={2}
              fill="url(#goldGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#C09428' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly gold buy power */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #E5DDD0' }}>
        <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#7A6A5A', letterSpacing: '0.08em' }}>
          Weekly Gold Buy Power
        </div>
        <div className="font-serif font-normal text-2xl mb-4" style={{ color: '#1A1008' }}>
          {weekGold}g (22K)
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart
            data={weeklyData.map((d) => ({ ...d, gold: d.amt > 0 ? +(d.amt / 7260).toFixed(3) : 0 }))}
            margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="goldGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B6914" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#8B6914" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: '#7A6A5A' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: number) => [v.toFixed(3) + 'g', 'Gold']}
              contentStyle={{
                border: 'none',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="gold"
              stroke="#8B6914"
              strokeWidth={2}
              fill="url(#goldGrad2)"
              dot={false}
              activeDot={{ r: 4, fill: '#8B6914' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
