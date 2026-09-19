import { useMemo } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler } from 'chart.js'
import type { ForecastDay } from '../types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler)

interface Props {
  days: ForecastDay[]
}

export function ForecastChart({ days }: Props) {
  const labels = useMemo(() => days.map(d => {
    const date = new Date(d.date + 'T00:00:00')
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
  }), [days])

  const shortLabels = useMemo(() => days.map(d => {
    const date = new Date(d.date + 'T00:00:00')
    return date.toLocaleDateString('en-IN', { weekday: 'short' })
  }), [days])

  // Temperature chart
  const tempData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'High °C',
        data: days.map(d => d.high_c),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249,115,22,0.12)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: '#f97316',
        pointBorderColor: 'rgba(255,255,255,0.9)',
        pointBorderWidth: 2,
        borderWidth: 3,
      },
      {
        label: 'Low °C',
        data: days.map(d => d.low_c),
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56,189,248,0.12)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: 'rgba(255,255,255,0.9)',
        pointBorderWidth: 2,
        borderWidth: 3,
      },
    ],
  }), [days, labels])

  // Rain probability chart
  const rainData = useMemo(() => ({
    labels: shortLabels,
    datasets: [{
      label: 'Rain %',
      data: days.map(d => d.rain_prob_percent),
      backgroundColor: days.map(d =>
        d.rain_prob_percent > 70 ? 'rgba(56,189,248,0.85)' :
        d.rain_prob_percent > 40 ? 'rgba(56,189,248,0.55)' :
        'rgba(56,189,248,0.3)'
      ),
      borderRadius: 6,
      borderSkipped: false,
    }],
  }), [days, shortLabels])

  // Wind speed chart
  const windData = useMemo(() => ({
    labels: shortLabels,
    datasets: [{
      label: 'Wind km/h',
      data: days.map(d => d.wind_kmh),
      backgroundColor: days.map(d =>
        d.wind_kmh > 40 ? 'rgba(168,85,247,0.7)' :
        d.wind_kmh > 20 ? 'rgba(168,85,247,0.45)' :
        'rgba(168,85,247,0.25)'
      ),
      borderRadius: 6,
      borderSkipped: false,
    }],
  }), [days, shortLabels])

  // UV index chart
  const uvData = useMemo(() => ({
    labels: shortLabels,
    datasets: [{
      label: 'UV Index',
      data: days.map(d => d.uv_index),
      backgroundColor: days.map(d =>
        d.uv_index >= 8 ? 'rgba(239,68,68,0.7)' :
        d.uv_index >= 5 ? 'rgba(249,115,22,0.6)' :
        d.uv_index >= 3 ? 'rgba(234,179,8,0.5)' :
        'rgba(34,197,94,0.4)'
      ),
      borderRadius: 6,
      borderSkipped: false,
    }],
  }), [days, shortLabels])

  const baseOpts: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        titleFont: { size: 11, family: 'DM Sans', weight: '600' },
        bodyFont: { size: 11, family: 'DM Sans' },
        padding: 10,
        cornerRadius: 10,
        displayColors: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { size: 10, family: 'DM Sans', weight: '500' }, color: 'rgba(255,255,255,0.5)', maxRotation: 0 },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.06)', drawBorder: false },
        border: { display: false },
        ticks: { font: { size: 10, family: 'DM Sans' }, color: 'rgba(255,255,255,0.4)' },
      },
    },
  }

  return (
    <div className="mx-4 mb-4 space-y-4 fade-in">
      {/* Temperature */}
      <ChartBlock title="Temperature" dotColor="bg-orange-400">
        <div className="h-40">
          <Line data={tempData} options={baseOpts} />
        </div>
        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-white/50">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> High</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Low</span>
        </div>
      </ChartBlock>

      {/* Rain + Wind side by side */}
      <div className="grid grid-cols-2 gap-3">
        <ChartBlock title="Rain %" dotColor="bg-sky-400">
          <div className="h-24">
            <Bar data={rainData} options={{ ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, max: 100, ticks: { ...baseOpts.scales.y.ticks, callback: (v: any) => v + '%' } } } }} />
          </div>
        </ChartBlock>
        <ChartBlock title="Wind" dotColor="bg-purple-400">
          <div className="h-24">
            <Bar data={windData} options={baseOpts} />
          </div>
        </ChartBlock>
      </div>

      {/* UV Index */}
      <ChartBlock title="UV Index" dotColor="bg-yellow-400">
        <div className="h-24">
          <Bar data={uvData} options={{ ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, max: 12 } } }} />
        </div>
        <div className="flex items-center justify-center gap-3 mt-2 text-[9px] text-white/40">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> 0-2 Low</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" /> 3-5 Mod</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" /> 6-7 High</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> 8+ Extreme</span>
        </div>
      </ChartBlock>
    </div>
  )
}

function ChartBlock({ title, dotColor, children }: { title: string; dotColor: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4 shadow-xl">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-[0.15em]">{title}</h3>
      </div>
      {children}
    </div>
  )
}
