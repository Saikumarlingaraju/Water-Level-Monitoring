import config from '../config';

describe('config smoke', () => {
  test('builds API and realtime URLs', () => {
    expect(config.API_BASE_URL).toBeTruthy();
    expect(config.SENSOR_DATA_URL).toContain('/sensor-data');
    expect(config.REALTIME_WS_URL).toContain('/api/v1/ws/realtime');
  });
});
