import { medusaIntegrationTestRunner } from "@medusajs/test-utils";

jest.setTimeout(60 * 1000);

medusaIntegrationTestRunner({
  inApp: true,
  env: {
    JWT_SECRET: "test-jwt-secret-minimum-32-chars-long",
    COOKIE_SECRET: "test-cookie-secret-minimum-32-chars",
    STORE_CORS: "http://localhost:3000",
    ADMIN_CORS: "http://localhost:9000",
    AUTH_CORS: "http://localhost:9000",
  },
  testSuite: ({ api }) => {
    describe("POST /store/auth/send-otp", () => {
      it("returns 422 when body is empty", async () => {
        const res = await api.post("/store/auth/send-otp", {}).catch((e: any) => e.response);
        expect(res.status).toBe(422);
        expect(res.data).toMatchObject({ error: "Validation failed" });
      });

      it("returns 422 when identifier is missing", async () => {
        const res = await api
          .post("/store/auth/send-otp", { firstName: "Test" })
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });

      it("returns 422 for identifier that is too short", async () => {
        const res = await api
          .post("/store/auth/send-otp", { identifier: "ab" })
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });
    });

    describe("POST /store/auth/verify-otp", () => {
      it("returns 422 when body is empty", async () => {
        const res = await api.post("/store/auth/verify-otp", {}).catch((e: any) => e.response);
        expect(res.status).toBe(422);
        expect(res.data).toMatchObject({ error: "Validation failed" });
      });

      it("returns 422 when otp field is missing", async () => {
        const res = await api
          .post("/store/auth/verify-otp", { identifier: "user@example.com" })
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });

      it("returns 422 when otp is not 6 digits", async () => {
        const res = await api
          .post("/store/auth/verify-otp", { identifier: "user@example.com", otp: "123" })
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });
    });

    describe("POST /store/auth/signup", () => {
      it("returns 422 when email is missing", async () => {
        const res = await api
          .post("/store/auth/signup", { password: "Test1234!" })
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });

      it("returns 422 when password is too short", async () => {
        const res = await api
          .post("/store/auth/signup", { email: "user@example.com", password: "short" })
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });
    });

    describe("POST /store/auth/login", () => {
      it("returns 422 when body is empty", async () => {
        const res = await api.post("/store/auth/login", {}).catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });

      it("returns 422 when password is missing", async () => {
        const res = await api
          .post("/store/auth/login", { identifier: "user@example.com" })
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });
    });

    describe("POST /store/auth/forgot-password", () => {
      it("returns 422 when identifier is missing", async () => {
        const res = await api
          .post("/store/auth/forgot-password", {})
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });
    });

    describe("POST /store/auth/reset-password", () => {
      it("returns 422 when fields are missing", async () => {
        const res = await api
          .post("/store/auth/reset-password", {})
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });

      it("returns 422 when new password is too short", async () => {
        const res = await api
          .post("/store/auth/reset-password", {
            identifier: "user@example.com",
            otp: "123456",
            new_password: "abc",
          })
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });
    });
  },
});
