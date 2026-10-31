export const SEVERITY_DISTRIBUTION = [
  { name: "Critical", value: 18, color: "#9f1239" },
  { name: "High", value: 45, color: "#b45309" },
  { name: "Medium", value: 82, color: "#ca8a04" },
  { name: "Low", value: 38, color: "#0369a1" },
  { name: "Info", value: 14, color: "#475569" },
];

export const RISK_TREND_DATA = [
  { month: "May", critical: 28, high: 62, resolved: 34, riskScore: 84 },
  { month: "Jun", critical: 24, high: 58, resolved: 48, riskScore: 79 },
  { month: "Jul", critical: 22, high: 54, resolved: 65, riskScore: 74 },
  { month: "Aug", critical: 21, high: 50, resolved: 78, riskScore: 71 },
  { month: "Sep", critical: 19, high: 47, resolved: 92, riskScore: 68 },
  { month: "Oct", critical: 18, high: 45, resolved: 104, riskScore: 62 },
];

export const ATTACK_VECTOR_RADAR = [
  { subject: "Network Perimeter", currentRisk: 68, benchmark: 45, fullMark: 100 },
  { subject: "Identity & IAM", currentRisk: 82, benchmark: 50, fullMark: 100 },
  { subject: "API Security", currentRisk: 74, benchmark: 55, fullMark: 100 },
  { subject: "Cloud Config", currentRisk: 58, benchmark: 40, fullMark: 100 },
  { subject: "Supply Chain", currentRisk: 89, benchmark: 60, fullMark: 100 },
  { subject: "Endpoint Hygiene", currentRisk: 42, benchmark: 35, fullMark: 100 },
];

export const RECURRING_VULNERABILITIES = [
  {
    id: "REC-01",
    name: "Broken Object Level Authorization (BOLA)",
    category: "OWASP API Security Top 10",
    recurrenceCount: 4,
    trend: "+2 this quarter",
    trendDirection: "up",
    affectedServices: ["Billing API", "Customer Portal", "Partner Webhooks"],
    rootCause: "Missing authorization check in microservice route wrappers before object ID lookup",
    recommendation: "Deploy centralized AuthZ middleware policy in Envoy Service Mesh",
    severity: "High"
  },
  {
    id: "REC-02",
    name: "Outdated TLS Ciphers & Legacy Protocols",
    category: "Cryptographic Configuration",
    recurrenceCount: 3,
    trend: "Unchanged",
    trendDirection: "neutral",
    affectedServices: ["cdn-proxy-edge-eu", "partner-gateway", "legacy-reports-sftp"],
    rootCause: "Outdated SSL certificates and default cipher strings inherited in Docker base templates",
    recommendation: "Enforce TLS 1.3 only via AWS CloudFront and Cloudflare Managed WAF",
    severity: "Medium"
  },
  {
    id: "REC-03",
    name: "Over-permissive Cloud IAM Role Wildcards (*)",
    category: "Cloud Security Posture",
    recurrenceCount: 5,
    trend: "-1 this quarter",
    trendDirection: "down",
    affectedServices: ["CI/CD GitHub Actions Runner", "Lambda Telemetry Ingestion", "K8s Node Role"],
    rootCause: "Developer velocity optimizations creating wildcard action permissions during prototyping",
    recommendation: "Enforce automated IAM Access Analyzer CI gate blocking wildcard policies",
    severity: "High"
  },
  {
    id: "REC-04",
    name: "Unpatched RCE via Open Source Packages",
    category: "Dependency Governance",
    recurrenceCount: 3,
    trend: "+1 new CVE",
    trendDirection: "up",
    affectedServices: ["media-render-worker", "pdf-generator-service"],
    rootCause: "Delayed image rebuild triggers and lack of automated Dependabot merging for C-libs",
    recommendation: "Implement automated daily trivy vulnerability scans in container registry",
    severity: "Critical"
  }
];

export const PRIORITY_FINDINGS = [
  {
    rank: 1,
    title: "Supply Chain SSH Backdoor in Core Bastion (XZ Utils)",
    cve: "CVE-2024-3094",
    cvss: 10.0,
    severity: "Critical",
    exploitability: "High (Weaponized Public PoC)",
    businessImpact: "Full infrastructure takeover; lateral access into all production Kubernetes clusters.",
    remediationEffort: "Immediate (1-2 Hours)",
    asset: "bastion-us-east-prod-01"
  },
  {
    rank: 2,
    title: "Container Sandbox Escape via runc File Descriptor Leak",
    cve: "CVE-2024-21626",
    cvss: 8.6,
    severity: "High",
    exploitability: "Moderate (Local Execution required)",
    businessImpact: "Compromise of container worker node grants access to adjacent pod secrets and cloud instance metadata.",
    remediationEffort: "Medium (4 Hours node rollout)",
    asset: "k8s-prod-us-west-cluster-node-09"
  },
  {
    rank: 3,
    title: "BOLA on Tenant Billing Information Endpoint",
    cve: "CVE-2023-38606",
    cvss: 8.6,
    severity: "High",
    exploitability: "High (Trivial Parameter Tampering)",
    businessImpact: "Breach of GDPR and PCI-DSS compliance; leakage of enterprise customer financial metadata.",
    remediationEffort: "Low (Patch API route handler)",
    asset: "api.threatlens.io/v2/users/{id}/billing"
  },
  {
    rank: 4,
    title: "WebP Codec Remote Heap Corruption in Media Microservice",
    cve: "CVE-2023-4863",
    cvss: 9.8,
    severity: "Critical",
    exploitability: "High (Attacker upload vector)",
    businessImpact: "Remote shell access inside public ingestion worker pods.",
    remediationEffort: "Low (Rebuild Alpine base image)",
    asset: "media-render-worker-prod-04"
  }
];

export const DEPARTMENT_COMPARISON = [
  { department: "Cloud Infra", openCritical: 6, openHigh: 14, totalFindings: 48, resolvedPercent: 78, threatScore: 68 },
  { department: "Core Engineering", openCritical: 5, openHigh: 18, totalFindings: 62, resolvedPercent: 65, threatScore: 74 },
  { department: "DevSecOps & SRE", openCritical: 4, openHigh: 8, totalFindings: 34, resolvedPercent: 88, threatScore: 48 },
  { department: "Corporate IT & Endpoints", openCritical: 2, openHigh: 3, totalFindings: 26, resolvedPercent: 82, threatScore: 52 },
  { department: "Data & ML Platform", openCritical: 1, openHigh: 2, totalFindings: 18, resolvedPercent: 91, threatScore: 35 },
];
