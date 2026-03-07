import React from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface AQSRadarChartProps {
  scores: {
    research?: number;
    education?: number;
    teaching?: number;
  };
  candidateName?: string;
  size?: 'small' | 'medium' | 'large';
}

const LazyRadarComponent: React.FC<AQSRadarChartProps> = ({
  scores,
  candidateName,
  size = 'medium',
}) => {
  const data = {
    labels: ['Research', 'Education', 'Teaching'],
    datasets: [
      {
        label: candidateName || 'Candidate',
        data: [
          scores.research || 0,
          scores.education || 0,
          scores.teaching || 0,
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
      },
    ],
  };

  const options = {
    scales: {
      r: {
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: {
          stepSize: 20,
          font: {
            size: size === 'small' ? 10 : 12,
          },
        },
        pointLabels: {
          font: {
            size: size === 'small' ? 11 : 13,
            weight: 'bold' as const,
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            return `${context.label}: ${context.parsed.r.toFixed(1)}`;
          },
        },
      },
    },
    responsive: true,
    maintainAspectRatio: true,
  };

  const heightClass = {
    small: 'h-40',
    medium: 'h-64',
    large: 'h-80',
  }[size];

  return (
    <div className={`w-full ${heightClass} flex items-center justify-center`}>
      <Radar data={data} options={options} />
    </div>
  );
};
export default LazyRadarComponent;
