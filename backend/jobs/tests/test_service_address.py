from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from jobs.service_address import (
    format_service_address_for_geocode,
    geocode_query_variants,
    is_valid_structured_service_address,
    parse_service_address,
    validate_structured_service_address,
)


class ServiceAddressValidationTests(SimpleTestCase):
    def test_parse_labeled_address(self):
        fields = parse_service_address(
            'Country: Canada\n'
            'Province: Ontario\n'
            'City: Ottawa\n'
            'Address 1: 77 Pine Rd\n'
            'Address 2: Unit 2\n'
            'Postal code: K1A 0B1'
        )
        self.assertEqual(fields['country'], 'Canada')
        self.assertEqual(fields['province'], 'Ontario')
        self.assertEqual(fields['city'], 'Ottawa')
        self.assertEqual(fields['address1'], '77 Pine Rd')
        self.assertEqual(fields['address2'], 'Unit 2')
        self.assertEqual(fields['postal_code'], 'K1A 0B1')

    def test_validate_accepts_complete_canadian_address(self):
        raw = (
            'Country: Canada\n'
            'Province: Ontario\n'
            'City: Ottawa\n'
            'Address 1: 77 Pine Rd\n'
            'Postal code: K1A0B1'
        )
        self.assertEqual(validate_structured_service_address(raw), raw)

    def test_validate_rejects_free_text(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_structured_service_address('77 Pine Rd')
        self.assertIn('service_address', ctx.exception.detail)

    def test_validate_rejects_bad_postal(self):
        raw = (
            'Country: Canada\n'
            'Province: Ontario\n'
            'City: Ottawa\n'
            'Address 1: 77 Pine Rd\n'
            'Postal code: ABC'
        )
        with self.assertRaises(ValidationError) as ctx:
            validate_structured_service_address(raw)
        self.assertIn('postal', str(ctx.exception.detail).lower())

    def test_is_valid_helper(self):
        self.assertFalse(is_valid_structured_service_address('77 Pine Rd'))
        self.assertTrue(
            is_valid_structured_service_address(
                'Country: Canada\n'
                'Province: Ontario\n'
                'City: Ottawa\n'
                'Address 1: 77 Pine Rd\n'
                'Postal code: K1A0B1'
            )
        )

    def test_format_for_geocode_strips_labels(self):
        labeled = (
            'Country: Canada\n'
            'Province: Ontario\n'
            'City: Ottawa\n'
            'Address 1: 77 Pine Rd\n'
            'Postal code: K1A0B1'
        )
        self.assertEqual(
            format_service_address_for_geocode(labeled),
            '77 Pine Rd, Ottawa, Ontario, K1A 0B1, Canada',
        )
        variants = geocode_query_variants(labeled)
        self.assertEqual(variants[0], '77 Pine Rd, Ottawa, Ontario, K1A 0B1, Canada')
        self.assertTrue(any('77 Pine Rd, Ottawa' in v for v in variants))
