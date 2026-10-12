// Jest setup file - Load environment variables from .env

// Set environment variable for tests
process.env.EXPO_PUBLIC_API_URL = 'https://iai185uz7sad1pes63f15.web-preview.appgen.com';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));
