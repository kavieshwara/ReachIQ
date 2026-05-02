import rateLimit from "../../node_modules/express-rate-limit/dist/index.cjs";

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => {
    const path = String(req.path || "");
    if (path === "/health" || path === "/ping") {
      return true;
    }

    return (
      process.env.NODE_ENV !== "production" &&
      ["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"].includes(req.ip || "")
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again in a few minutes."
  }
});
