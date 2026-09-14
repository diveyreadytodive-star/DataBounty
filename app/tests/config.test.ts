import { describe, expect, it } from 'vitest';
import { createConfig, getIntegrationReadiness } from '../src/config';

describe('explicit DataBounty configuration', () => {
  it('disables chain actions when the package ID is absent', () => {
    const config = createConfig({});
    expect(config.packageId).toBeNull();
    expect(getIntegrationReadiness(config)).toMatchObject({ package: false, seal: false, walrus: true });
  });
  it('accepts only the explicit DataBounty package env value', () => {
    const config = createConfig({ VITE_DATABOUNTY_PACKAGE_ID: `0x${'a'.repeat(64)}`, VITE_SEAL_KEY_SERVER_IDS: `0x${'b'.repeat(64)}` });
    expect(config.packageId).toBe(`0x${'a'.repeat(64)}`);
    expect(config.sealServerIds).toEqual([`0x${'b'.repeat(64)}`]);
    expect(getIntegrationReadiness(config)).toMatchObject({ package: true, seal: true, walrus: true });
  });
});
