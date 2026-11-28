import {
  buildServerSearchFilters,
  computeArrivalIso,
  filterSpaceResults,
  useSearchStore,
} from '../store/search.store';

describe('useSearchStore & search helper functions', () => {
  beforeEach(() => {
    useSearchStore.getState().resetFilters();
    useSearchStore.getState().setQuery('');
  });

  it('computes future ISO arrival timestamps from offset minutes', () => {
    const baseMs = Date.UTC(2026, 10, 28, 8, 0, 0);
    expect(computeArrivalIso(0, baseMs)).toBe(new Date(baseMs + 2 * 60_000).toISOString());
    expect(computeArrivalIso(30, baseMs)).toBe(new Date(baseMs + 30 * 60_000).toISOString());
  });

  it('builds server POST /search filters matching active amenity toggles and vehicle class', () => {
    expect(
      buildServerSearchFilters({ evOnly: false, coveredOnly: false, gatedOnly: false }),
    ).toBeUndefined();

    expect(
      buildServerSearchFilters(
        { evOnly: true, coveredOnly: true, gatedOnly: true },
        'suv',
      ),
    ).toEqual({
      evCharging: true,
      coveredParking: true,
      securityLevel: 'gated',
      vehicleType: 'suv',
    });
  });

  it('filters local/demo space results consistently across combined toggles', () => {
    const sample = [
      { id: '1', amenities: { evCharging: true, covered: true, securityLevel: 'gated' } },
      { id: '2', amenities: { evCharging: true, covered: false, securityLevel: 'monitored' } },
      { id: '3', amenities: { evCharging: false, covered: true, securityLevel: 'none' } },
    ];

    expect(
      filterSpaceResults(sample, { evOnly: true, coveredOnly: false, gatedOnly: false }).map(
        (s) => s.id,
      ),
    ).toEqual(['1', '2']);

    expect(
      filterSpaceResults(sample, { evOnly: true, coveredOnly: true, gatedOnly: true }).map(
        (s) => s.id,
      ),
    ).toEqual(['1']);
  });

  it('synchronizes query, arrival offset, duration, and reset cleanly', () => {
    useSearchStore.getState().setQuery('Adyar');
    useSearchStore.getState().setArrivalOffset(60);
    useSearchStore.getState().setDurationHours(4);
    useSearchStore.getState().toggleAmenity('evOnly');

    const state = useSearchStore.getState();
    expect(state.query).toBe('Adyar');
    expect(state.arrivalOffsetMinutes).toBe(60);
    expect(state.durationHours).toBe(4);
    expect(state.amenities.evOnly).toBe(true);

    useSearchStore.getState().resetFilters();
    expect(useSearchStore.getState().arrivalOffsetMinutes).toBe(0);
    expect(useSearchStore.getState().durationHours).toBe(2);
    expect(useSearchStore.getState().amenities.evOnly).toBe(false);
  });
});
