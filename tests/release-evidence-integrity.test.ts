import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const remediation = JSON.parse(readFileSync(new URL(
  '../artifacts/release/hosted-watermark-remediation-20260714.json',
  import.meta.url,
), 'utf8')) as {
  verification: {
    publishedFactsBeforeAndAfter: {
      premiumChecksum: string;
      lossChecksum: string;
    };
  };
};

const controlledRecovery = JSON.parse(readFileSync(new URL(
  '../artifacts/release/hosted-controlled-recovery-20260714.json',
  import.meta.url,
), 'utf8')) as {
  failure: {
    publishedFactsUnchanged: {
      premiumCount: number;
      premiumChecksumBeforeAndAfter: string;
      lossCount: number;
      lossChecksumBeforeAndAfter: string;
    };
  };
};

describe('hosted release evidence integrity', () => {
  it('stores valid 32-character hexadecimal checksums', () => {
    const checksums = [
      remediation.verification.publishedFactsBeforeAndAfter.premiumChecksum,
      remediation.verification.publishedFactsBeforeAndAfter.lossChecksum,
      controlledRecovery.failure.publishedFactsUnchanged.premiumChecksumBeforeAndAfter,
      controlledRecovery.failure.publishedFactsUnchanged.lossChecksumBeforeAndAfter,
    ];

    for (const checksum of checksums) {
      expect(checksum).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it('keeps the pre-recovery fact snapshot consistent across hosted artifacts', () => {
    expect(remediation.verification.publishedFactsBeforeAndAfter).toEqual({
      premiumCount: controlledRecovery.failure.publishedFactsUnchanged.premiumCount,
      premiumChecksum: controlledRecovery.failure.publishedFactsUnchanged.premiumChecksumBeforeAndAfter,
      lossCount: controlledRecovery.failure.publishedFactsUnchanged.lossCount,
      lossChecksum: controlledRecovery.failure.publishedFactsUnchanged.lossChecksumBeforeAndAfter,
    });
  });
});
