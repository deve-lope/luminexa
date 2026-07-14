from unittest.mock import patch

from django.test import SimpleTestCase

from businesses.geocode import search_locations


class SearchLocationsTests(SimpleTestCase):
    @patch('businesses.geocode._nominatim_search', return_value=[])
    @patch('businesses.geocode._geocoder_ca_address_search', return_value=[])
    @patch('businesses.geocode._photon_search')
    def test_prefers_photon_results(self, photon_mock, _ca_mock, _nominatim_mock):
        photon_mock.return_value = [{
            'display_name': '117 Marcos Boulevard, Toronto, Ontario, M1K 5A7, Canada',
            'latitude': 43.75005,
            'longitude': -79.25815,
            'city': 'Toronto',
            'state': 'Ontario',
            'postal_code': 'M1K5A7',
            'country': 'Canada',
        }]
        results = search_locations('117 marcos', country='Canada')
        self.assertEqual(len(results), 1)
        self.assertIn('Marcos', results[0]['display_name'])
        photon_mock.assert_called_once()
        _nominatim_mock.assert_not_called()

    @patch('businesses.geocode._nominatim_search')
    @patch('businesses.geocode._geocoder_ca_address_search', return_value=[])
    @patch('businesses.geocode._photon_search', return_value=[])
    def test_falls_back_to_nominatim(self, _photon_mock, ca_mock, nominatim_mock):
        nominatim_mock.return_value = [{
            'display_name': 'Main Street, Toronto, Canada',
            'latitude': 43.7,
            'longitude': -79.4,
            'city': 'Toronto',
            'state': 'Ontario',
            'postal_code': '',
            'country': 'Canada',
        }]
        results = search_locations('main st toronto', country='Canada')
        self.assertEqual(len(results), 1)
        nominatim_mock.assert_called()
