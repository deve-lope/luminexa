from businesses.region_codes import (
    merge_unique_sorted,
    reference_cities,
    reference_postal_codes,
    resolve_state_code,
    state_matches,
)


def test_resolve_state_code():
    assert resolve_state_code('Ontario') == 'ON'
    assert resolve_state_code('TX') == 'TX'
    assert resolve_state_code('Texas') == 'TX'


def test_state_matches():
    assert state_matches('Ontario', 'Ontario')
    assert state_matches('ON', 'Ontario')
    assert state_matches('Texas', 'TX')
    assert not state_matches('TX', 'Ontario')


def test_reference_postal_codes_filtered_by_state_and_city():
    on_codes = reference_postal_codes(state='Ontario')
    assert all(len(c) == 6 for c in on_codes)
    assert 'K1A0A1' in on_codes
    assert '78701' not in on_codes
    ottawa_codes = reference_postal_codes(state='Ontario', city='Ottawa')
    assert 'K1A0A1' in ottawa_codes
    assert 'M5V0A1' not in ottawa_codes


def test_reference_cities_for_state():
    cities = reference_cities(state='Ontario')
    assert 'Ottawa' in cities
    assert 'Toronto' in cities


def test_merge_unique_sorted():
    assert merge_unique_sorted(['K1Z5G5', 'K1A'], ['K1A', 'K2P']) == ['K1A', 'K1Z5G5', 'K2P']
