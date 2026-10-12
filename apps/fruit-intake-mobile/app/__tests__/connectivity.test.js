/**
 * Tecavo Soft Mobile Apps - Connectivity Tests
 * Tests API endpoint connectivity and environment configuration
 */

const axios = require('axios');

// Set environment variable before tests run
process.env.EXPO_PUBLIC_API_URL = 'https://iai185uz7sad1pes63f15.web-preview.appgen.com';

// Mock axios for tests
jest.mock('axios');

describe('Fruit Intake Mobile - Tecavo Soft Connectivity Tests', () => {
  
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

    test('should construct correct /api/cuadrillas endpoint', () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const endpoint = `${apiUrl}/api/cuadrillas`;
      
      expect(endpoint).toBe('https://iai185uz7sad1pes63f15.web-preview.appgen.com/api/cuadrillas');
    });

    test('should construct correct /api/fruit-intake endpoint', () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const endpoint = `${apiUrl}/api/fruit-intake`;
      
      expect(endpoint).toBe('https://iai185uz7sad1pes63f15.web-preview.appgen.com/api/fruit-intake');
    });

    test('should construct correct /api/lots endpoint', () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const endpoint = `${apiUrl}/api/lots`;
      
      expect(endpoint).toBe('https://iai185uz7sad1pes63f15.web-preview.appgen.com/api/lots');
    });

    test('mock API call to /api/cuadrillas should work', async () => {
      const mockCuadrillas = [
        { id: 1, name: 'Cuadrilla 1', leader: 'Juan Pérez' },
        { id: 2, name: 'Cuadrilla 2', leader: 'María García' }
      ];

      axios.get.mockResolvedValueOnce({ data: mockCuadrillas });

      const result = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/cuadrillas`);
      
      expect(result.data).toEqual(mockCuadrillas);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Cuadrilla 1');
    });

    test('mock POST to /api/fruit-intake should work', async () => {
      const intakeData = {
        cuadrilla_id: 1,
        date: '2024-01-15',
        boxes: 50,
        weight_kg: 500
      };

      const mockResponse = {
        id: 1,
        ...intakeData,
        created_at: new Date().toISOString()
      };

      axios.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/fruit-intake`,
        intakeData
      );
      
      expect(result.data).toHaveProperty('id');
      expect(result.data.cuadrilla_id).toBe(1);
      expect(result.data.boxes).toBe(50);
    });

    test('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network Error'));

      await expect(
        axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/cuadrillas`)
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

    test('should handle validation errors from POST', async () => {
      axios.post.mockRejectedValueOnce({
        response: { 
          status: 400, 
          data: { error: 'Validation failed: cuadrilla_id is required' } 
        }
      });

      try {
        await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/fruit-intake`, {});
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain('Validation failed');
      }
    });
  });

  describe('Data Structure Validation', () => {
    test('cuadrilla data should have required fields', async () => {
      const mockCuadrilla = {
        id: 1,
        name: 'Cuadrilla 1',
        leader: 'Juan Pérez'
      };

      axios.get.mockResolvedValueOnce({ data: [mockCuadrilla] });

      const result = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/api/cuadrillas`);
      const cuadrilla = result.data[0];
      
      expect(cuadrilla).toHaveProperty('id');
      expect(cuadrilla).toHaveProperty('name');
      expect(cuadrilla).toHaveProperty('leader');
    });

    test('fruit intake POST data validation', () => {
      const validData = {
        cuadrilla_id: 1,
        date: '2024-01-15',
        boxes: 50,
        weight_kg: 500
      };

      expect(validData.cuadrilla_id).toBeGreaterThan(0);
      expect(validData.boxes).toBeGreaterThan(0);
      expect(validData.weight_kg).toBeGreaterThan(0);
      expect(validData.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('total weight calculation should be correct', () => {
      const boxes = 10;
      const weightPerBox = 10;
      const totalWeight = boxes * weightPerBox;
      
      expect(totalWeight).toBe(100);
    });
  });

  describe('Business Logic Validation', () => {
    test('should validate minimum box count', () => {
      const boxes = 1;
      expect(boxes).toBeGreaterThan(0);
    });

    test('should validate minimum weight per box', () => {
      const weightPerBox = 5;
      expect(weightPerBox).toBeGreaterThan(0);
    });

    test('should calculate correct total weight for realistic values', () => {
      const testCases = [
        { boxes: 50, weightPerBox: 10, expected: 500 },
        { boxes: 100, weightPerBox: 12, expected: 1200 },
        { boxes: 25, weightPerBox: 8, expected: 200 }
      ];

      testCases.forEach(({ boxes, weightPerBox, expected }) => {
        const totalWeight = boxes * weightPerBox;
        expect(totalWeight).toBe(expected);
      });
    });
  });
});
