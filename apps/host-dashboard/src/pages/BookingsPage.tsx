import { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useBookings, HostBooking } from '../hooks/useHostData';
import { hostApi } from '../utils/apiClient';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { CarIcon, CheckCircleIcon, CalendarIcon, XCircleIcon } from '../components/Icons';

function formatRemainingOrOverstay(b: HostBooking): { label: string; tone: 'blue' | 'red' | 'green' | 'neutral' } {
  const endMs = new Date(b.endTime).getTime();
  const startMs = new Date(b.startTime).getTime();
  const nowMs = Date.now();

  if (b.status === 'completed') {
    if ((b.overstayMinutes || 0) > 0) {
      return { label: `+${b.overstayMinutes}m overstay (₹${b.overstayAmount || 0})`, tone: 'red' };
    }
    return { label: 'Completed on time', tone: 'green' };
  }
  if (b.status === 'cancelled' || b.status === 'refunded') {
    return { label: 'Cancelled', tone: 'neutral' };
  }
  if (b.status === 'confirmed') {
    const minsToStart = Math.round((startMs - nowMs) / 60_000);
    if (minsToStart > 0) return { label: `Starts in ${minsToStart}m`, tone: 'blue' };
    return { label: 'Ready for check-in', tone: 'blue' };
  }
  if (b.status === 'active') {
    const diffMins = Math.round((endMs - nowMs) / 60_000);
    if (diffMins >= 0) {
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      return { label: h > 0 ? `${h}h ${m}m left` : `${m}m left`, tone: 'blue' };
    }
    const overMins = Math.abs(diffMins);
    return {
      label: overMins <= 10 ? `Grace (${overMins}m over)` : `Overstay +${overMins}m`,
      tone: 'red',
    };
  }
  return { label: b.status, tone: 'neutral' };
}

export default function BookingsPage() {
  useDocumentTitle('Reservations & Bookings');
  const [statusFilter, setStatusFilter] = useState('all');
  const { bookings, loading, error, refetch } = useBookings(statusFilter === 'all' ? undefined : statusFilter);
  const [selected, setSelected] = useState<HostBooking | null>(null);
  const [gateInput, setGateInput] = useState('');
  const [gateBusy, setGateBusy] = useState(false);
  const [gateMessage, setGateMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const activeCount = bookings.filter((b) => b.status === 'active' || b.status === 'confirmed').length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;

  const handleGateVerify = async (action: 'verify' | 'check_in' | 'check_out') => {
    const trimmed = gateInput.trim();
    if (!trimmed) {
      setGateMessage({ kind: 'err', text: 'Enter the driver 4-digit Gate PIN or paste their QR pass token.' });
      return;
    }
    setGateBusy(true);
    setGateMessage(null);
    try {
      const isPin = /^[0-9]{4}$/.test(trimmed);
      const matchedBooking = isPin ? bookings.find((b) => b.gateCode === trimmed) : undefined;
      const resp = await hostApi.verifyGatePass(
        isPin
          ? { gateCode: trimmed, bookingId: matchedBooking?.id, action }
          : { qrToken: trimmed, action },
      );
      const data = resp.data?.data;
      if (!data?.valid) {
        setGateMessage({ kind: 'err', text: data?.reason || 'Gate pass could not be verified.' });
      } else {
        const b = data.booking;
        const verb = action === 'check_in' ? 'Checked in' : action === 'check_out' ? 'Checked out' : 'Verified';
        setGateMessage({
          kind: 'ok',
          text: `${verb}: ${b?.vehicle?.licensePlate || b?.vehiclePlate || 'Vehicle'} · Slot window ends ${new Date(b.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`,
        });
        if (action !== 'verify') {
          setGateInput('');
          await refetch();
        }
      }
    } catch (err: any) {
      setGateMessage({
        kind: 'err',
        text: err?.response?.data?.error?.message || err?.message || 'Gate verification failed.',
      });
    } finally {
      setGateBusy(false);
    }
  };

  const handleCheckIn = async (b: HostBooking) => {
    setRowBusyId(b.id);
    try {
      await hostApi.checkInBooking(b.id);
      await refetch();
      if (selected?.id === b.id) setSelected(null);
    } catch (err: any) {
      setGateMessage({
        kind: 'err',
        text: err?.response?.data?.error?.message || err?.message || 'Could not check in driver.',
      });
    } finally {
      setRowBusyId(null);
    }
  };

  const handleCheckOut = async (b: HostBooking) => {
    setRowBusyId(b.id);
    try {
      const resp = await hostApi.checkOutBooking(b.id);
      const updated = resp.data?.data;
      if (updated?.overstayMinutes > 0) {
        setGateMessage({
          kind: 'ok',
          text: `Driver checked out with ${updated.overstayMinutes}m overstay (+₹${updated.overstayAmount}). Bay is now free.`,
        });
      } else {
        setGateMessage({ kind: 'ok', text: `Driver checked out on time. Bay #${b.id.slice(0, 6)} is now open.` });
      }
      await refetch();
      if (selected?.id === b.id) setSelected(null);
    } catch (err: any) {
      setGateMessage({
        kind: 'err',
        text: err?.response?.data?.error?.message || err?.message || 'Could not check out driver.',
      });
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Bookings' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservations &amp; Bookings</h1>
          <p className="page-subtitle">
            Track active parking sessions, check-in timestamps, and driver registration numbers.
          </p>
        </div>
      </div>

      {/* Host Gate Handshake: QR Token / 4-Digit Gate PIN Verifier */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>
              Gate Arrival &amp; Exit Verification (QR Pass or 4-Digit PIN)
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Verify a driver&apos;s QR pass or residential 4-digit Gate PIN to start their session or confirm departure &amp; overstay.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              style={{ width: 230 }}
              placeholder="4-digit PIN (e.g. 4821) or QR token"
              value={gateInput}
              onChange={(e) => setGateInput(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={gateBusy}
              onClick={() => handleGateVerify('verify')}
            >
              Verify
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={gateBusy}
              onClick={() => handleGateVerify('check_in')}
            >
              Verify &amp; Check In
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={gateBusy}
              onClick={() => handleGateVerify('check_out')}
            >
              Check Out
            </button>
          </div>
        </div>
        {gateMessage && (
          <div
            className={`status-banner status-banner--${gateMessage.kind === 'ok' ? 'success' : 'error'}`}
            style={{ marginTop: 12 }}
          >
            <span>{gateMessage.text}</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Active Now', value: String(activeCount), Icon: CarIcon, color: 'var(--blue)' },
          { label: 'Completed', value: String(completedCount), Icon: CheckCircleIcon, color: 'var(--green)' },
          { label: 'Total Listed', value: String(bookings.length), Icon: CalendarIcon, color: 'var(--text-primary)' },
          { label: 'Cancelled', value: String(cancelledCount), Icon: XCircleIcon, color: 'var(--red)' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="stat-card">
            <div>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color }}>{value}</div>
            </div>
            <div className="stat-icon">
              <Icon size={18} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading reservations...
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Driver</th>
                  <th>Vehicle Plate</th>
                  <th>Gate PIN</th>
                  <th>Parking Space</th>
                  <th>Planned Window</th>
                  <th>Session Timer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const timing = formatRemainingOrOverstay(b);
                  return (
                  <tr key={b.id}>
                    <td className="mono-num" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      #{b.id.slice(0, 8)}
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {b.driverName || 'Guest Driver'}
                      {b.leavingNotifiedAt && b.status === 'active' && (
                        <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700, marginTop: 2 }}>
                          Leaving Soon
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral mono-num">{b.vehiclePlate || 'TN01AB1234'}</span>
                    </td>
                    <td className="mono-num" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {b.gateCode || '—'}
                    </td>
                    <td>{b.spaceName || 'T Nagar Spot A'}</td>
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' → '}
                      {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span className={`badge badge-${timing.tone}`}>{timing.label}</span>
                    </td>
                    <td className="mono-num" style={{ color: 'var(--green)', fontWeight: 700 }}>
                      ₹{b.totalAmount}
                    </td>
                    <td>
                      <span
                        className={`badge badge-${b.status === 'active' || b.status === 'confirmed'
                          ? 'blue'
                          : b.status === 'completed'
                            ? 'green'
                            : 'red'
                          }`}
                      >
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {b.status === 'confirmed' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={rowBusyId === b.id}
                            onClick={() => handleCheckIn(b)}
                          >
                            Check In
                          </button>
                        )}
                        {b.status === 'active' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={rowBusyId === b.id}
                            onClick={() => handleCheckOut(b)}
                          >
                            Check Out
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setSelected(b)}
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Booking Details Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        titleId="booking-detail-title"
        maxWidth={480}
        title={
          selected ? (
            <>
              Reservation <span className="mono-num">#{selected.id.slice(0, 8)}</span>
            </>
          ) : null
        }
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            {selected?.status === 'confirmed' && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={rowBusyId === selected.id}
                onClick={() => handleCheckIn(selected)}
              >
                Confirm Arrival &amp; Check In
              </button>
            )}
            {selected?.status === 'active' && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={rowBusyId === selected.id}
                onClick={() => handleCheckOut(selected)}
              >
                Confirm Exit &amp; Check Out
              </button>
            )}
            <button type="button" className="btn btn-outline" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Driver', selected.driverName || 'Driver'],
              ['Phone', selected.driverPhone || '—'],
              ['Vehicle Plate', selected.vehiclePlate || '—'],
              ['4-Digit Gate PIN', selected.gateCode || '—'],
              ['Facility', selected.spaceName || selected.spaceId],
              ['Total Paid', `₹${selected.totalAmount}`],
              ['Status', selected.status.toUpperCase()],
              ['Planned Window', `${new Date(selected.startTime).toLocaleString()} → ${new Date(selected.endTime).toLocaleString()}`],
              ['Checked In At', selected.checkedInAt ? new Date(selected.checkedInAt).toLocaleString() : 'Not checked in yet'],
              ['Checked Out At', selected.checkedOutAt ? new Date(selected.checkedOutAt).toLocaleString() : 'Still active / upcoming'],
              ['Driver Leaving Alert', selected.leavingNotifiedAt ? `Notified at ${new Date(selected.leavingNotifiedAt).toLocaleTimeString()}` : 'Not sent'],
              ...(selected.overstayMinutes && selected.overstayMinutes > 0
                ? [['Overstay Settlement', `${selected.overstayMinutes} mins (+₹${selected.overstayAmount || 0})`]]
                : []),
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 13.5,
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <strong className="mono-num" style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{v}</strong>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
