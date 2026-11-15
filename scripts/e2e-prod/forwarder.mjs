// Test rig only. Listens on FWD_PORT and forwards every request to the production build on UPSTREAM_PORT,
// giving each request its own made-up client address in X-Forwarded-For.
//
// WHY: a production build ignores RATE_LIMIT_DISABLED (src/lib/rateLimit.ts), and the e2e suite registers and signs
// in dozens of accounts from one machine. Without this the suite would be stopped by the (correctly working) rate
// limiter. The app reads the LAST X-Forwarded-For entry (src/lib/http.ts), exactly as it does behind the real
// host's proxy, so the limiter itself runs unchanged: each request simply looks like a different visitor.
// Never put this in front of a real site.
import http from "node:http";

const port = Number(process.env.FWD_PORT);
const upstreamPort = Number(process.env.UPSTREAM_PORT);
if (!Number.isInteger(port) || !Number.isInteger(upstreamPort)) {
  console.error("forwarder: set FWD_PORT and UPSTREAM_PORT");
  process.exit(2);
}

let n = 0;
const server = http.createServer((req, res) => {
  n += 1;
  const headers = { ...req.headers, "x-forwarded-for": `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}` };
  const up = http.request({ host: "127.0.0.1", port: upstreamPort, method: req.method, path: req.url, headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.rawHeaders);
    r.pipe(res);
  });
  up.on("error", (e) => {
    if (!res.headersSent) res.statusCode = 502;
    res.end(res.headersSent ? undefined : `forwarder: ${e.message}`);
  });
  // When the visitor goes away, hang up on the app too, so it sees the disconnect (streams rely on it).
  res.on("close", () => {
    if (!res.writableFinished) up.destroy();
  });
  req.pipe(up);
});

server.listen(port, "127.0.0.1", () => console.log("FWD READY"));
const stop = () => {
  server.close(() => process.exit(0));
  server.closeAllConnections();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
