jest.mock("../redis", () => ({
  getRedisClient: jest.fn(),
}));

import { getRedisClient } from "../redis";
import {
  setOtp,
  getOtp,
  deleteOtp,
  isRateLimited,
  incrementAttempts,
  clearAttempts,
  MAX_ATTEMPTS,
} from "../otp-store";

const mockRedis = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getRedisClient as jest.Mock).mockReturnValue(mockRedis);
  mockRedis.setex.mockResolvedValue("OK");
  mockRedis.get.mockResolvedValue(null);
  mockRedis.del.mockResolvedValue(1);
  mockRedis.incr.mockResolvedValue(1);
  mockRedis.expire.mockResolvedValue(1);
});

describe("MAX_ATTEMPTS", () => {
  it("is 5", () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});

describe("setOtp", () => {
  it("stores otp and rate-limit key with TTL", async () => {
    await setOtp("test@example.com", { otp: "123456" });

    expect(mockRedis.setex).toHaveBeenCalledTimes(2);

    const [otpKey, otpTtl, otpValue] = mockRedis.setex.mock.calls[0];
    expect(otpKey).toBe("otp:test@example.com");
    expect(otpTtl).toBe(600);
    const parsed = JSON.parse(otpValue);
    expect(parsed.otp).toBe("123456");
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());

    const [rateLimitKey, rateLimitTtl, rateLimitValue] = mockRedis.setex.mock.calls[1];
    expect(rateLimitKey).toBe("otp_sent:test@example.com");
    expect(rateLimitTtl).toBe(60);
    expect(rateLimitValue).toBe("1");
  });

  it("includes firstName and lastName when provided", async () => {
    await setOtp("user@example.com", { otp: "999999", firstName: "Ali", lastName: "Khan" });

    const stored = JSON.parse(mockRedis.setex.mock.calls[0][2]);
    expect(stored.firstName).toBe("Ali");
    expect(stored.lastName).toBe("Khan");
  });
});

describe("getOtp", () => {
  it("returns null when key does not exist", async () => {
    mockRedis.get.mockResolvedValue(null);
    expect(await getOtp("missing@example.com")).toBeNull();
  });

  it("returns parsed entry when key exists", async () => {
    const entry = { otp: "111111", expiresAt: Date.now() + 60000 };
    mockRedis.get.mockResolvedValue(JSON.stringify(entry));

    const result = await getOtp("user@example.com");
    expect(result).toEqual(entry);
  });

  it("returns null for malformed JSON", async () => {
    mockRedis.get.mockResolvedValue("not-json");
    expect(await getOtp("user@example.com")).toBeNull();
  });
});

describe("deleteOtp", () => {
  it("deletes the otp key", async () => {
    await deleteOtp("user@example.com");
    expect(mockRedis.del).toHaveBeenCalledWith("otp:user@example.com");
  });
});

describe("isRateLimited", () => {
  it("returns true when rate-limit key exists", async () => {
    mockRedis.get.mockResolvedValue("1");
    expect(await isRateLimited("user@example.com")).toBe(true);
  });

  it("returns false when rate-limit key is absent", async () => {
    mockRedis.get.mockResolvedValue(null);
    expect(await isRateLimited("user@example.com")).toBe(false);
  });
});

describe("incrementAttempts", () => {
  it("returns the incremented count", async () => {
    mockRedis.incr.mockResolvedValue(3);
    expect(await incrementAttempts("user@example.com")).toBe(3);
  });

  it("sets TTL on first attempt (count === 1)", async () => {
    mockRedis.incr.mockResolvedValue(1);
    await incrementAttempts("user@example.com");
    expect(mockRedis.expire).toHaveBeenCalledWith("otp_attempts:user@example.com", 600);
  });

  it("does not set TTL on subsequent attempts", async () => {
    mockRedis.incr.mockResolvedValue(2);
    await incrementAttempts("user@example.com");
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });
});

describe("clearAttempts", () => {
  it("deletes the attempts key", async () => {
    await clearAttempts("user@example.com");
    expect(mockRedis.del).toHaveBeenCalledWith("otp_attempts:user@example.com");
  });
});
