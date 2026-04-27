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
    describe("POST /store/checkout/create-order", () => {
      it("returns 422 when body is empty", async () => {
        const res = await api
          .post("/store/checkout/create-order", {})
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
        expect(res.data).toMatchObject({ error: "Validation failed" });
      });

      it("returns 422 when amount_in_rupees is missing", async () => {
        const res = await api
          .post("/store/checkout/create-order", { cart_id: "cart_01abc" })
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });

      it("returns 422 when amount_in_rupees is zero or negative", async () => {
        const res = await api
          .post("/store/checkout/create-order", { cart_id: "cart_01abc", amount_in_rupees: 0 })
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });
    });

    describe("POST /store/checkout/verify-payment", () => {
      it("returns 422 when body is empty", async () => {
        const res = await api
          .post("/store/checkout/verify-payment", {})
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
        expect(res.data).toMatchObject({ error: "Validation failed" });
      });

      it("returns 422 when razorpay_signature is missing", async () => {
        const res = await api
          .post("/store/checkout/verify-payment", {
            razorpay_order_id: "order_abc",
            razorpay_payment_id: "pay_abc",
          })
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
      });
    });

    describe("POST /store/checkout/complete", () => {
      it("returns 422 when cart_id is missing", async () => {
        const res = await api
          .post("/store/checkout/complete", {})
          .catch((e: any) => e.response);
        expect(res.status).toBe(422);
        expect(res.data).toMatchObject({ error: "Validation failed" });
      });
    });
  },
});
