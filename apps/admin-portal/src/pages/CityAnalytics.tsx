import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { adminApi } from '../utils/apiClient';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { ParkingIcon, ClockIcon, LeafIcon, GaugeIcon, ZapIcon } from '../components/Icons';

interface ChokePointMetric {
  intersection: string;
  unsatisfiedSearches: number;
}

export default function CityAnalytics() {
  useDocumentTitle('City Mobility & Carbon Analytics');

  const [period, setPeriod] = useState('2026-W36');
  const [selectedZone, setSelectedZone] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [analyticsData, setAnalyticsData] = useState<{
    offStreetHoursProvided: number;
    cruisingMinutesReduced: number;
    co2AbatedKg: number;
    chokePoints: ChokePointMetric[];
    recommendation: string;
    reportGeneratedAt: string;
  }>({
    offStreetHoursProvided: 0,
    cruisingMinutesReduced: 0,
    co2AbatedKg: 0,
    chokePoints: [],
    recommendation: '',
    reportGeneratedAt: '',
  });

  const handleRunAnalysis = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const zones =
        selectedZone === 'all'
          ? ['t-nagar', 'anna-nagar', 'omr', 'adyar']
          : [selectedZone];
      const res = await adminApi.getCityAnalytics({
        cityId: 'chennai',
        period,
        zones,
      });

      const data = res.data?.data;
      const metrics = data?.metrics || data;
      if (metrics) {
        setAnalyticsData({
          offStreetHoursProvided: Number(metrics.totalOffStreetHoursProvided || 0),
          cruisingMinutesReduced: Number(metrics.estimatedCurbsideCruisingReducedMinutes || 0),
          co2AbatedKg: Number(metrics.estimatedCO2AbatedKg || 0),
          chokePoints: Array.isArray(metrics.unmetDemandChokePoints)
            ? metrics.unmetDemandChokePoints.map((cp: any) => ({
                intersection: String(cp.intersection || cp.zone || 'Unknown Zone'),
                unsatisfiedSearches: Number(cp.unsatisfiedSearches || 0),
              }))
            : [],
          recommendation: data?.recommendation || '',
          reportGeneratedAt: data?.reportGeneratedAt || new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to compute city mobility analytics');
    } finally {
      setLoading(false);
    }
  }, [period, selectedZone]);

  useEffect(() => {
    handleRunAnalysis();
  }, [handleRunAnalysis]);

  return (
    <div>
      <Breadcrumbs items={[{ label: 'City Mobility Analytics' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Chennai Mobility &amp; Carbon Analytics</h1>
          <p className="page-subtitle">
            Multi-zone cruising reduction, off-street hour absorption, and CMDA carbon credits audit.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            aria-label="Zone Filter"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            style={{ width: 150 }}
          >
            <option value="all">All Corridors</option>
            <option value="t-nagar">T Nagar</option>
            <option value="anna-nagar">Anna Nagar</option>
            <option value="omr">OMR Corridor</option>
            <option value="adyar">Adyar</option>
          </select>
          <select
            className="form-select"
            aria-label="Analytics Period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ width: 155 }}
          >
            <option value="2026-W36">2026 - Week 36</option>
            <option value="2026-W35">2026 - Week 35</option>
            <option value="2026-W34">2026 - Week 34</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={handleRunAnalysis} disabled={loading}>
            <ZapIcon size={15} />
            {loading ? 'Analyzing...' : 'Run City Analysis'}
          </button>
        </div>
      </div>

      {error && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Off-Street Hours Supplied', value: `${analyticsData.offStreetHoursProvided.toLocaleString('en-IN')} hrs`, Icon: ParkingIcon, color: 'var(--blue)' },
          { label: 'Cruising Minutes Saved', value: `${analyticsData.cruisingMinutesReduced.toLocaleString('en-IN')} min`, Icon: ClockIcon, color: 'var(--green)' },
          { label: 'CO2 Abated (GCC)', value: `${analyticsData.co2AbatedKg.toLocaleString('en-IN')} kg`, Icon: LeafIcon, color: 'var(--green)' },
          { label: 'Choke Points Tracked', value: String(analyticsData.chokePoints.length), Icon: GaugeIcon, color: 'var(--text-primary)' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="stat-card">
            <div>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color, fontSize: 22 }}>{value}</div>
            </div>
            <div className="stat-icon">
              <Icon size={18} />
            </div>
          </div>
        ))}
      </div>

      {analyticsData.recommendation && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--green-border)' }}>
          <div className="card-meta" style={{ color: 'var(--green)', marginBottom: 6 }}>
            AI Policy Recommendation
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55 }}>{analyticsData.recommendation}</p>
        </div>
      )}

      {/* Unmet Demand Chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">Unsatisfied Demand Hotspots by Corridor</h2>
          <span className="card-meta">Chennai Metro</span>
        </div>
        {analyticsData.chokePoints.length === 0 ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {loading ? 'Running city analytics...' : 'No unmet demand choke points reported for this period.'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={analyticsData.chokePoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2D8" vertical={false} />
              <XAxis dataKey="intersection" tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={{ stroke: '#DFDDD4' }} tickLine={false} />
              <YAxis tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF',
                  border: '1px solid #C9C5B9',
                  borderRadius: 8,
                  color: '#0B1628',
                }}
              />
              <Bar dataKey="unsatisfiedSearches" fill="#D90410" name="Unsatisfied Searches" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Critical Choke Points Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Chennai Corridor Demand &amp; Supply Priority</h2>
          <span className="card-meta">Real-Time Telemetry</span>
        </div>
        <div className="table-wrap">
          {analyticsData.chokePoints.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No choke point records.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Zone / Corridor</th>
                  <th>Priority Level</th>
                  <th>Unsatisfied Searches</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.chokePoints.map((cp) => {
                  const severity = cp.unsatisfiedSearches >= 30 ? 'HIGH' : cp.unsatisfiedSearches >= 15 ? 'MODERATE' : 'LOW';
                  return (
                    <tr key={cp.intersection}>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{cp.intersection}</td>
                      <td>
                        <span className={`badge badge-${severity === 'HIGH' ? 'red' : severity === 'MODERATE' ? 'yellow' : 'green'}`}>
                          {severity}
                        </span>
                      </td>
                      <td className="mono-num" style={{ color: 'var(--accent-cta)', fontWeight: 700 }}>{cp.unsatisfiedSearches}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
