import { useState } from 'react';
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
  Legend,
} from 'recharts';
import { adminApi } from '../utils/apiClient';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { ParkingIcon, ClockIcon, LeafIcon, GaugeIcon, ZapIcon } from '../components/Icons';

export default function CityAnalytics() {
  useDocumentTitle('City Mobility & Carbon Analytics');

  const [period, setPeriod] = useState('2026-W36');
  const [selectedZone] = useState('all');
  const [loading, setLoading] = useState(false);

  const [analyticsData, setAnalyticsData] = useState({
    offStreetHoursSupplied: 14280,
    cruisingMinutesReduced: 52400,
    co2AbatedKg: 1842.5,
    activeCorridorsCount: 8,
    chokePoints: [
      { name: 'Panagal Park North Intersection', zone: 'T Nagar', severity: 'HIGH', cruisingMinutes: 18400, delayRelief: '38%', pct: 38 },
      { name: 'Roundtana 2nd Avenue Junction', zone: 'Anna Nagar', severity: 'MODERATE', cruisingMinutes: 14200, delayRelief: '27%', pct: 27 },
      { name: 'Madhya Kailash Tech Junction', zone: 'OMR Corridor', severity: 'HIGH', cruisingMinutes: 12600, delayRelief: '31%', pct: 31 },
      { name: 'Lattice Bridge Road Cross', zone: 'Adyar', severity: 'LOW', cruisingMinutes: 7200, delayRelief: '19%', pct: 19 },
    ],
    zonePerformance: [
      { zone: 'T Nagar', offStreetHrs: 5200, co2Abated: 680, cruisingSaved: 21000 },
      { zone: 'Anna Nagar', offStreetHrs: 3800, co2Abated: 490, cruisingSaved: 15200 },
      { zone: 'OMR', offStreetHrs: 3400, co2Abated: 440, cruisingSaved: 11400 },
      { zone: 'Adyar', offStreetHrs: 1880, co2Abated: 232, cruisingSaved: 4800 },
    ],
  });

  const handleRunAnalysis = async () => {
    setLoading(true);
    try {
      const zones = selectedZone === 'all' ? ['t-nagar', 'anna-nagar', 'omr', 'adyar'] : [selectedZone];
      const res = await adminApi.getCityAnalytics({
        cityId: 'chennai',
        period,
        zones,
      });

      const data = res.data?.data;
      if (data) {
        setAnalyticsData((prev) => ({
          ...prev,
          offStreetHoursSupplied: data.totalOffStreetHoursSupplied || prev.offStreetHoursSupplied,
          cruisingMinutesReduced: data.cruisingMinutesReduced || prev.cruisingMinutesReduced,
          co2AbatedKg: data.co2AbatedKg || prev.co2AbatedKg,
        }));
      }
    } catch (err: any) {
      console.warn('Real-time analytics fetch warning, keeping local baseline:', err);
    } finally {
      setLoading(false);
    }
  };

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

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Off-Street Hours Supplied', value: `${analyticsData.offStreetHoursSupplied.toLocaleString()} hrs`, Icon: ParkingIcon, color: 'var(--blue)' },
          { label: 'Cruising Minutes Saved', value: `${analyticsData.cruisingMinutesReduced.toLocaleString()} min`, Icon: ClockIcon, color: 'var(--green)' },
          { label: 'CO2 Abated (GCC)', value: `${analyticsData.co2AbatedKg.toLocaleString()} kg`, Icon: LeafIcon, color: 'var(--green)' },
          { label: 'Congestion Relief', value: '88.4 / 100', Icon: GaugeIcon, color: 'var(--text-primary)' },
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

      {/* Corridor Relief Strip */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2 className="card-title">Corridor Diversion Horizon</h2>
          <span className="card-meta">Peak Hour Choke Relief</span>
        </div>
        <div className="corridor-strip">
          {analyticsData.chokePoints.map((cp) => (
            <div key={cp.name} className="corridor-tile">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{cp.zone}</span>
                <span className="mono-num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent-cta)' }}>
                  {cp.delayRelief}
                </span>
              </div>
              <div className="corridor-bar-track">
                <div
                  className="corridor-bar-fill"
                  style={{
                    width: `${cp.pct}%`,
                    background: cp.severity === 'HIGH' ? 'var(--accent-cta)' : cp.severity === 'MODERATE' ? 'var(--yellow)' : 'var(--green)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Corridor Cruising Minutes Saved by Zone</h2>
            <span className="card-meta">Minutes Reduced</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={analyticsData.zonePerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2D8" vertical={false} />
              <XAxis dataKey="zone" tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={{ stroke: '#DFDDD4' }} tickLine={false} />
              <YAxis tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="cruisingSaved" fill="#D90410" name="Cruising Saved (min)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Carbon Credits &amp; Off-Street Hours</h2>
            <span className="card-meta">GCC Telemetry</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={analyticsData.zonePerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2D8" vertical={false} />
              <XAxis dataKey="zone" tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={{ stroke: '#DFDDD4' }} tickLine={false} />
              <YAxis tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ color: '#334155', fontSize: 12 }} />
              <Line type="monotone" dataKey="co2Abated" name="CO2 Abated (kg)" stroke="#0F766E" strokeWidth={2.25} />
              <Line type="monotone" dataKey="offStreetHrs" name="Off-Street Hours" stroke="#0B1628" strokeWidth={2.25} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Choke Points Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Chennai GCC Corridor Choke Points &amp; Diversion Efficiency</h2>
          <span className="card-meta">Period {period}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Corridor / Choke Point</th>
                <th>Chennai Zone</th>
                <th>Traffic Severity</th>
                <th>Cruising Minutes Reduced</th>
                <th>Relief Factor</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.chokePoints.map((cp) => (
                <tr key={cp.name}>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{cp.name}</td>
                  <td>
                    <span className="badge badge-blue">{cp.zone}</span>
                  </td>
                  <td>
                    <span className={`badge badge-${cp.severity === 'HIGH' ? 'red' : cp.severity === 'MODERATE' ? 'yellow' : 'green'}`}>
                      {cp.severity}
                    </span>
                  </td>
                  <td className="mono-num" style={{ color: 'var(--green)', fontWeight: 700 }}>
                    {cp.cruisingMinutes.toLocaleString()} min
                  </td>
                  <td className="mono-num" style={{ fontWeight: 700, color: 'var(--accent-cta)' }}>
                    {cp.delayRelief}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
