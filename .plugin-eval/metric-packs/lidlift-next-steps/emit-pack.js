const fs = require("node:fs");
const path = require("node:path");

const [, , targetPathArg, targetKindArg] = process.argv;

const targetPath = path.resolve(
  process.cwd(),
  targetPathArg || process.env.PLUGIN_EVAL_TARGET || ".",
);
const targetKind = targetKindArg || process.env.PLUGIN_EVAL_TARGET_KIND || "directory";

function exists(relPath) {
  return fs.existsSync(path.join(targetPath, relPath));
}

function read(relPath) {
  const fullPath = path.join(targetPath, relPath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function countPresent(paths) {
  return paths.filter((relPath) => exists(relPath)).length;
}

function band(value, total) {
  const ratio = total === 0 ? 0 : value / total;
  if (ratio >= 1) return "excellent";
  if (ratio >= 0.75) return "good";
  if (ratio >= 0.5) return "fair";
  return "poor";
}

const benchmarkPaths = [
  "benchmarks/lidlift-guardrail-benchmark.json",
  "benchmarks/README.md",
];

const analyticsSignals = [
  {
    id: "analytics_package",
    present: /@vercel\/analytics|@vercel\/speed-insights/.test(read("apps/web/package.json")),
    evidence: "apps/web/package.json",
  },
  {
    id: "telemetry_library",
    present: exists("apps/web/lib/telemetry.ts"),
    evidence: "apps/web/lib/telemetry.ts",
  },
  {
    id: "analyze_route_tracking",
    present:
      /telemetry|track|analytics/i.test(read("apps/web/app/api/analyze/route.ts")) ||
      /telemetry|track|analytics/i.test(read("apps/web/components/analyzer-console.tsx")),
    evidence: "apps/web/app/api/analyze/route.ts or apps/web/components/analyzer-console.tsx",
  },
];

const securityPaths = [".github/dependabot.yml", "SECURITY.md"];
const publicProofPaths = ["apps/web/app/evals/page.tsx"];

const benchmarkPresent = countPresent(benchmarkPaths);
const analyticsPresent = analyticsSignals.filter((signal) => signal.present).length;
const securityPresent = countPresent(securityPaths);
const publicProofPresent = countPresent(publicProofPaths);

const totalDeliverables =
  benchmarkPaths.length +
  analyticsSignals.length +
  securityPaths.length +
  publicProofPaths.length;
const presentDeliverables =
  benchmarkPresent + analyticsPresent + securityPresent + publicProofPresent;

const missing = {
  benchmark: benchmarkPaths.filter((relPath) => !exists(relPath)),
  analytics: analyticsSignals.filter((signal) => !signal.present).map((signal) => signal.id),
  security: securityPaths.filter((relPath) => !exists(relPath)),
  publicProof: publicProofPaths.filter((relPath) => !exists(relPath)),
};

function checkFromCount({ id, message, evidencePrefix, present, total }) {
  const missingCount = total - present;
  return {
    id,
    category: "next-steps",
    severity: missingCount === 0 ? "info" : "warning",
    status: missingCount === 0 ? "pass" : "warn",
    message:
      missingCount === 0
        ? `${message}: complete`
        : `${message}: ${present}/${total} present`,
    evidence: [`${evidencePrefix}: ${present}/${total}`],
    remediation:
      missingCount === 0
        ? []
        : [`Add the missing deliverables for ${id} before calling the roadmap complete.`],
  };
}

const result = {
  checks: [
    {
      id: "target-kind-supported",
      category: "next-steps",
      severity: "info",
      status: ["directory", "plugin"].includes(targetKind) ? "pass" : "warn",
      message: `Metric pack evaluated target kind: ${targetKind}`,
      evidence: [targetPath],
      remediation: ["Run plugin-eval analyze against the repo root or plugin root."],
    },
    checkFromCount({
      id: "benchmark-harness",
      message: "Benchmark harness deliverables",
      evidencePrefix: "benchmarks",
      present: benchmarkPresent,
      total: benchmarkPaths.length,
    }),
    checkFromCount({
      id: "analytics-telemetry",
      message: "Analytics and telemetry deliverables",
      evidencePrefix: "analytics",
      present: analyticsPresent,
      total: analyticsSignals.length,
    }),
    checkFromCount({
      id: "security-workflow",
      message: "Security workflow deliverables",
      evidencePrefix: "security",
      present: securityPresent,
      total: securityPaths.length,
    }),
    checkFromCount({
      id: "public-eval-surface",
      message: "Public eval/demo deliverables",
      evidencePrefix: "eval",
      present: publicProofPresent,
      total: publicProofPaths.length,
    }),
  ],
  metrics: [
    {
      id: "next-step-deliverables-complete",
      category: "next-steps",
      value: presentDeliverables,
      unit: "deliverables",
      band: band(presentDeliverables, totalDeliverables),
    },
    {
      id: "benchmark-assets-present",
      category: "next-steps",
      value: benchmarkPresent,
      unit: "files",
      band: band(benchmarkPresent, benchmarkPaths.length),
    },
    {
      id: "analytics-signals-present",
      category: "next-steps",
      value: analyticsPresent,
      unit: "signals",
      band: band(analyticsPresent, analyticsSignals.length),
    },
    {
      id: "security-assets-present",
      category: "next-steps",
      value: securityPresent,
      unit: "files",
      band: band(securityPresent, securityPaths.length),
    },
    {
      id: "public-proof-assets-present",
      category: "next-steps",
      value: publicProofPresent,
      unit: "files",
      band: band(publicProofPresent, publicProofPaths.length),
    },
  ],
  artifacts: [
    {
      id: "missing-next-step-deliverables",
      type: "custom",
      label: "Missing next-step deliverables",
      description: JSON.stringify(missing),
    },
  ],
};

process.stdout.write(JSON.stringify(result));
