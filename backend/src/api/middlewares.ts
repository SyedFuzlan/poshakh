import { defineMiddlewares, MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// Medusa v2.13.6 RoutesSorter bug: routes with matcher "/" have empty segments
// after split/filter and are silently dropped. Use "/*" wildcard middleware instead.
export default defineMiddlewares({
  routes: [
    {
      matcher: "/*",
      middlewares: [
        (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
          if (req.method === "GET" && req.originalUrl === "/") {
            return res.json({ status: "ok", service: "poshakh-api" });
          }
          next();
        },
      ],
    },
  ],
});
