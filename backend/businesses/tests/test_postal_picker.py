from businesses.postal import (
    is_complete_postal_code,
    picker_postal_codes,
    to_picker_postal_code,
)
from businesses.region_codes import reference_postal_codes


def test_to_picker_postal_expands_canadian_fsa():
    assert to_picker_postal_code('K1P', state='Ontario') == 'K1P0A1'
    assert to_picker_postal_code('K1Z5G5', state='Ontario') == 'K1Z5G5'


def test_to_picker_postal_us_zip():
    assert to_picker_postal_code('78701', state='Texas') == '78701'
    assert to_picker_postal_code('787011234', state='Texas') == '78701'


def test_is_complete_postal_code():
    assert is_complete_postal_code('K1Z5G5', state='Ontario')
    assert not is_complete_postal_code('K1Z', state='Ontario')
    assert is_complete_postal_code('78701', state='Texas')


def test_picker_postal_codes_drops_fsa_when_full_exists():
    codes = picker_postal_codes(['K1Z', 'K1P', 'K1Z5G5', 'K1Z5G6'], state='Ontario')
    assert 'K1Z5G5' in codes
    assert 'K1Z5G6' in codes
    assert 'K1P0A1' in codes
    assert 'K1Z0A1' not in codes
    assert 'K1Z' not in codes
    assert 'K1P' not in codes
    assert all(len(c) == 6 for c in codes)


def test_reference_postal_codes_are_complete():
    ottawa_codes = reference_postal_codes(state='Ontario', city='Ottawa')
    assert ottawa_codes
    assert all(len(c) == 6 for c in ottawa_codes)
    assert 'K1A0A1' in ottawa_codes
