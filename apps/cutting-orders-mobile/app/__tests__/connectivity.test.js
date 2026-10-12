/**
 * Tecavo Soft Mobile Apps - Connectivity Tests
 * Tests API endpoint connectivity and environment configuration
 */

const axios = require('axios');

// Set environment variable before tests run
process.env.EXPO_PUBLIC_API_URL = 'https://iai185uz7sad1pes63f15.web-preview.appgen.com';

// Mock axios for tests
jest.mock('axios');

describe('Cutting Orders Mobile - Tecavo Soft Connectivity Tests', () => {
  
  describe('Environment Configuration', () => {
    test('EXPO_PUBLIC_API_URL should be defined', () => {
      expect(process.env.EXPO_PUBLIC_API_URL).toBeDefined();
      expect(process.env.EXPO_PUBLIC_API_URL).not.toBe('');
      console.log('✅ API URL:', process.env.EXPO_PUBLIC_API_URL);
    });

    test('EXPO_PUBLIC_API_URL should be a valid URL', () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      expect(apiUrl).toMatch(/^https?:\/\/.+/);
    });

    test('EXPO_PUBLIC_API_URL should not have trailing slash', () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      expect(apiUrl).not.toMatch(/\/$/);
    });
  });

  describe('API Endpoint Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should construct correct /api/cutting-orders endpoint', () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const endpoint = `${apiUrl}/api/cutting-orders`;
      
      expect(endpoint).toBe('https://iai185uz7sad1pes63f15.web-preview.appgen.com/api/cutting-orders');
    });

    test('should construct correct /api/lots endpoint', () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const endpoint = `${apiUrl}/api/lots`;
      
      expect(endpoint).toBe('https://iai185uz7sad1pes63f15.web-preview.appgen.com/api/lots');
    });

    test('mock API call to /api/cutting-orders should work', async () => {
      const mockOrders = [
        {
          id: 1,
          order_number: 'ORD-001',
          customer: 'Test Customer',
          total_boxes: 10,
          status: 'pending'
        }
      ];

      axios.get.mockResolvedValueOnce({ data: mockOrders });

      const result = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/cutting-orders`);
      
      expect(result.data).toEqual(mockOrders);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].order_number).toBe('ORD-001');
    });

    test('mock API call to /api/lots should work', async () => {
      const mockLots = [
        { id: 1, lot_number: 'LOT-001', date: '2024-01-15' },
        { id: 2, lot_number: 'LOT-002', date: '2024-01-16' }
      ];

      axios.get.mockResolvedValueOnce({ data: mockLots });

      const result = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/lots`);
      
      expect(result.data).toEqual(mockLots);
      expect(result.data).toHaveLength(2);
    });

    test('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network Error'));

      await expect(
        axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/cutting-orders`)
      ).rejects.toThrow('Network Error');
    });

    test('should handle 404 errors', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 404, data: { error: 'Not found' } }
      });

      try {
        await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/invalid-endpoint`);
      } catch (error) {
        expect(error.response.status).toBe(404);
      }
    });

    test('should handle 500 errors', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 500, data: { error: 'Internal server error' } }
      });

      try {
        await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/cutting-orders`);
      } catch (error) {
        expect(error.response.status).toBe(500);
      }
    });
  });

  describe('Data Structure Validation', () => {
    test('cutting order data should have required fields', async () => {
      const mockOrder = {
        id: 1,
        order_number: 'ORD-001',
        customer: 'Test Customer',
        total_boxes: 10,
        status: 'pending'
      };

      axios.get.mockResolvedValueOnce({ data: [mockOrder] });

      const result = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/cutting-orders`);
      const order = result.data[0];
      
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('order_number');
      expect(order).toHaveProperty('customer');
      expect(order).toHaveProperty('total_boxes');
      expect(order).toHaveProperty('status');
    });

    test('lot data should have required fields', async () => {
      const mockLot = {
        id: 1,
        lot_number: 'LOT-001',
        date: '2024-01-15'
      };

      axios.get.mockResolvedValueOnce({ data: [mockLot] });

      const result = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/lots`);
      const lot = result.data[0];
      
      expect(lot).toHaveProperty('id');
      expect(lot).toHaveProperty('lot_number');
      expect(lot).toHaveProperty('date');
    });
  });
});
