/**
 * Privacy Scrubber Tests
 */

import { scrubObject, scrubValue } from "../index";

describe("Privacy Scrubber", () => {
  it("redacts sensitive fields and values", () => {
    const input = {
      email: "user@example.com",
      api_key: "secret",
      profile: {
        phone: "+1 555 555 5555",
      },
      note: "ok",
    };

    const result = scrubObject(input);

    expect(result.email).toBe("[REDACTED_EMAIL]");
    expect(result.api_key).toBe("[REDACTED_SECRET]");
    expect((result.profile as { phone?: string }).phone).toBe(
      "[REDACTED_PHONE]"
    );
    expect(result.note).toBe("ok");
  });

  it("truncates long strings", () => {
    const longValue = "a".repeat(600);
    const scrubbed = scrubValue(longValue) as string;

    expect(scrubbed.length).toBeLessThan(longValue.length);
    expect(scrubbed.endsWith("...")).toBe(true);
  });
});
