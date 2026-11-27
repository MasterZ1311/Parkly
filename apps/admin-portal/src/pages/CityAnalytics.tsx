import React, { useEffect, useState, useCallback } from 'react';
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
      setError(err.response?.data?.error?.message || 'Unable to compute city mobility analytics');
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
          <h1 className="page-title">Chennai Mobility &amp; Urban Carbon Analytics</h1>
          <p className="page-subtitle">
            Autonomous multi-zone cruising reduction, off-street hour absorption &amp; CMDA carbon telemetry.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            className="form-select"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            style={{ width: 150 }}
          >
            <option value="all">All Chennai Zones</option>
            <option value="t-nagar">T Nagar</option>
            <option value="anna-nagar">Anna Nagar</option>
            <option value="omr">OMR Corridor</option>
            <option value="adyar">Adyar</option>
          </select>
          <select
            className="form-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ width: 140 }}
          >
            <option value="2026-W36">2026 - Week 36</option>
            <option value="2026-W35">2026 - Week 35</option>
            <option value="2026-W34">2026 - Week 34</option>
          </select>
          <button className="btn btn-primary" onClick={handleRunAnalysis} disabled={loading}>
            {loading ? 'Analyzing...' : '⚡ Run City Analysis'}
          </button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Off-Street Hours Supplied', value: `${analyticsData.offStreetHoursProvided.toLocaleString('en-IN')} hrs`, icon: '🅿️', color: '#EF010C', bg: 'rgba(239,1,12,0.15)' },
          { label: 'Cruising Minutes Saved', value: `${analyticsData.cruisingMinutesReduced.toLocaleString('en-IN')} min`, icon: '⏱️', color: '#10B981', bg: '#10B98120' },
          { label: 'CO2 Abated (GCC)', value: `${analyticsData.co2AbatedKg.toLocaleString('en-IN')} kg`, icon: '🌱', color: '#8B5CF6', bg: '#8B5CF620' },
          { label: 'Choke Points Tracked', value: String(analyticsData.chokePoints.length), icon: '🚦', color: '#F59E0B', bg: '#F59E0B20' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {analyticsData.recommendation && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--green)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', marginBottom: 6 }}>
            AI Policy Recommendation
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{analyticsData.recommendation}</p>
        </div>
      )}

      {/* Unmet Demand Chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
          Unsatisfied Demand Hotspots by Corridor
        </h3>
        {analyticsData.chokePoints.length === 0 ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {loading ? 'Running city analytics...' : 'No unmet demand choke points reported for this period.'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={analyticsData.chokePoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#263957" />
              <XAxis dataKey="intersection" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#111D33', border: '1px solid #263957', borderRadius: 8, color: '#F9FAFB' }} />
              <Bar dataKey="unsatisfiedSearches" fill="#EF010C" name="Unsatisfied Searches" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Critical Choke Points Table */}
      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
          🚨 Chennai Corridor Demand &amp; Supply Priority
        </h3>
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
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cp.intersection}</td>
                      <td>
                        <span className={`badge badge-${severity === 'HIGH' ? 'red' : severity === 'MODERATE' ? 'yellow' : 'green'}`}>
                          {severity}
                        </span>
                      </td>
                      <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{cp.unsatisfiedSearches}</td>
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
