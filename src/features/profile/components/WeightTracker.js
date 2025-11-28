import React, { useState, useEffect } from 'react';
import { getWeightHistory, getWeightStats } from '../../../services/healthJourneyService';
import styles from './WeightTracker.module.css';

/**
 * WeightTracker Component
 *
 * Displays weight progress with chart visualization and statistics
 */
const WeightTracker = ({ userId, onLogWeight }) => {
  const [weightHistory, setWeightHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30'); // days

  useEffect(() => {
    loadWeightData();
  }, [userId, timeRange]);

  const loadWeightData = async () => {
    try {
      setIsLoading(true);

      // Get weight history for selected time range
      const days = parseInt(timeRange);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const history = await getWeightHistory(userId, startDate, endDate);
      const statistics = await getWeightStats(userId);

      setWeightHistory(history);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading weight data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>Loading weight data...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h3>Start Your Weight Journey</h3>
          <p>Begin tracking your weight to see your progress over time</p>
          <button className={styles.logButton} onClick={onLogWeight}>
            Log Your First Weight
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Weight Progress</h2>
        <div className={styles.timeRangeSelector}>
          <button
            className={timeRange === '7' ? styles.active : ''}
            onClick={() => setTimeRange('7')}
          >
            7D
          </button>
          <button
            className={timeRange === '30' ? styles.active : ''}
            onClick={() => setTimeRange('30')}
          >
            30D
          </button>
          <button
            className={timeRange === '90' ? styles.active : ''}
            onClick={() => setTimeRange('90')}
          >
            90D
          </button>
          <button
            className={timeRange === 'all' ? styles.active : ''}
            onClick={() => setTimeRange('all')}
          >
            ALL
          </button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Current</span>
          <span className={styles.statValue}>{stats.current} lbs</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Starting</span>
          <span className={styles.statValue}>{stats.start} lbs</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Goal</span>
          <span className={styles.statValue}>
            {stats.target ? `${stats.target} lbs` : 'Not set'}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Progress</span>
          <span className={styles.statValue}>
            {stats.lostSoFar > 0 ? `-${stats.lostSoFar}` : stats.lostSoFar} lbs
          </span>
        </div>
      </div>

      {stats.target && (
        <div className={styles.progressBar}>
          <div className={styles.progressBarLabel}>
            <span>{Math.round(stats.progressPercentage)}% to goal</span>
            <span>{stats.remaining} lbs to go</span>
          </div>
          <div className={styles.progressBarTrack}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${Math.min(stats.progressPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {weightHistory.length > 0 && (
        <div className={styles.chartContainer}>
          <WeightChart data={weightHistory} target={stats.target} />
        </div>
      )}

      {stats.averageWeeklyLoss !== 0 && (
        <div className={styles.insights}>
          <p className={styles.insightText}>
            {stats.averageWeeklyLoss > 0
              ? `📉 Average weekly loss: ${stats.averageWeeklyLoss.toFixed(1)} lbs`
              : `📈 Average weekly gain: ${Math.abs(stats.averageWeeklyLoss).toFixed(1)} lbs`}
          </p>
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.logButton} onClick={onLogWeight}>
          Log Weight
        </button>
      </div>
    </div>
  );
};

/**
 * WeightChart Component
 *
 * SVG-based line chart for weight visualization
 */
const WeightChart = ({ data, target }) => {
  if (!data || data.length === 0) return null;

  // Sort data by date
  const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Chart dimensions
  const width = 600;
  const height = 300;
  const padding = 40;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  // Calculate min and max values
  const weights = sortedData.map(d => d.weight);
  const minWeight = Math.min(...weights, target || Infinity) - 5;
  const maxWeight = Math.max(...weights) + 5;
  const weightRange = maxWeight - minWeight;

  // Create points for the line
  const points = sortedData.map((entry, index) => {
    // Handle single data point by centering it
    const x = sortedData.length === 1
      ? padding + chartWidth / 2
      : padding + (index / (sortedData.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((entry.weight - minWeight) / weightRange) * chartHeight;
    return { x, y, ...entry };
  });

  // Create path for the line
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Target line
  const targetY = target
    ? padding + chartHeight - ((target - minWeight) / weightRange) * chartHeight
    : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const y = padding + chartHeight * (1 - ratio);
        const weight = (minWeight + weightRange * ratio).toFixed(0);
        return (
          <g key={i}>
            <line
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#eee"
              strokeWidth="1"
            />
            <text
              x={padding - 10}
              y={y + 5}
              textAnchor="end"
              fontSize="12"
              fill="#666"
            >
              {weight}
            </text>
          </g>
        );
      })}

      {/* Target line */}
      {targetY && (
        <line
          x1={padding}
          y1={targetY}
          x2={width - padding}
          y2={targetY}
          stroke="#4CAF50"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
      )}

      {/* Weight line */}
      <path
        d={linePath}
        fill="none"
        stroke="#2196F3"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((point, i) => (
        <circle
          key={i}
          cx={point.x}
          cy={point.y}
          r="5"
          fill="#2196F3"
          stroke="#fff"
          strokeWidth="2"
        >
          <title>{`${point.weight} lbs - ${new Date(point.date).toLocaleDateString()}`}</title>
        </circle>
      ))}

      {/* Date labels (show first and last) */}
      <text
        x={padding}
        y={height - 10}
        fontSize="12"
        fill="#666"
        textAnchor="start"
      >
        {new Date(sortedData[0].date).toLocaleDateString()}
      </text>
      <text
        x={width - padding}
        y={height - 10}
        fontSize="12"
        fill="#666"
        textAnchor="end"
      >
        {new Date(sortedData[sortedData.length - 1].date).toLocaleDateString()}
      </text>
    </svg>
  );
};

export default WeightTracker;
