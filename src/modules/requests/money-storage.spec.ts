import { getMetadataArgsStorage } from 'typeorm';
import { RideRequest } from './entities/ride-request.entity.js';

describe('money persistence', () => {
  it('almacena la contribución como bigint de centavos', () => {
    const column = getMetadataArgsStorage().columns.find(
      (item) =>
        item.target === RideRequest &&
        item.propertyName === 'offeredContributionMinor',
    );
    expect(column?.options.type).toBe('bigint');
  });
});
