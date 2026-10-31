export const INITIAL_CONVERSATION = [
  {
    id: "msg-1",
    sender: "assistant",
    timestamp: "10:30 AM",
    content: `ThreatLens Decision Support Agent online. 6 audit reports indexed, mapping 111 active findings, 18 critical risks, and infrastructure attack surfaces.

Available automated advisory functions:
- Evaluate exploitability and blast radius of specific CVE records
- Draft remediation scripts and least-privilege IAM policies
- Formulate compliance executive briefs (ISO 27001, SOC2 Type II, NIST SP 800-53)
- Correlate recurring findings across multiple quarters`,
    citations: [
      {
        source: "PwC_ThreatLens_Infra_PenTest_Q3_2026.pdf",
        section: "Executive Summary, Page 4",
        cve: "CVE-2024-3094",
        relevance: "Primary reference for 4 critical perimeter findings"
      },
      {
        source: "KPMG_API_Vulnerability_Report_v2.pdf",
        section: "Section 3.2: BOLA Vector Analysis",
        cve: "CVE-2023-38606",
        relevance: "Cross-tenant authorization leak documentation"
      }
    ]
  },
  {
    id: "msg-2",
    sender: "user",
    timestamp: "10:32 AM",
    content: "What is the highest priority risk in our infrastructure right now, and what is the exact blast radius?",
    citations: []
  },
  {
    id: "msg-3",
    sender: "assistant",
    timestamp: "10:33 AM",
    content: `### Highest Priority Risk: Upstream Backdoor in XZ Utils / SSH Compression (CVE-2024-3094)

The highest priority vulnerability in the environment is **CVE-2024-3094** (CVSS **10.0 Critical**) discovered on **\`bastion-us-east-prod-01\` (10.240.12.8)**.

#### Technical Overview and Impact:
A malicious backdoor introduced into \`xz-utils\` releases 5.6.0 and 5.6.1 intercepts \`RSA_public_decrypt\` within \`sshd\`. This enables an unauthenticated attacker possessing the private attacker key to execute arbitrary commands as root prior to SSH authentication.

#### Blast Radius Evaluation:
1. Perimeter Ingress Compromise: \`bastion-us-east-prod-01\` serves as the primary jumpbox for SREs into the AWS US-East production VPC.
2. Kubernetes Control Plane Access: The host holds cached IAM instance credentials with \`eks:DescribeCluster\` and \`sts:AssumeRole\` privileges into the production cluster.
3. Lateral Movement Potential: High. If breached, the adversary inherits administrative access to internal production databases (\`aurora-pg-prod-cluster\`) and secrets vaults.

#### Immediate Mitigation Sequence:
\`\`\`bash
# 1. Downgrade package on bastion host immediately
sudo apt-get update && sudo apt-get install --allow-downgrades -y \\
  xz-utils=5.4.5-0.1 liblzma5=5.4.5-0.1

# 2. Terminate all active unverified SSH sessions
sudo pkill -KILL -u $(whoami) -t pts/*

# 3. Rotate bastion host SSH host keys and AWS IAM instance profiles
sudo ssh-keygen -A && sudo systemctl restart sshd
aws iam update-assume-role-policy --role-name BastionJumpHostRole ...
\`\`\``,
    citations: [
      {
        source: "PwC_ThreatLens_Infra_PenTest_Q3_2026.pdf",
        section: "Section 4.1: Critical Bastion Findings, Page 18",
        cve: "CVE-2024-3094",
        relevance: "Identifies vulnerable liblzma.so.5.6.1 in memory of 10.240.12.8"
      },
      {
        source: "NIST NVD Database",
        section: "NVD Detail CVE-2024-3094",
        cve: "CVE-2024-3094",
        relevance: "Base Score 10.0 CRITICAL (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H)"
      },
      {
        source: "ThreatLens Continuous Watch",
        section: "Asset Telemetry Registry: bastion-us-east-prod-01",
        cve: "Internal Tag: TIER-1",
        relevance: "Confirms host maintains direct routing to production Aurora database subnets"
      }
    ]
  }
];

export const PRESET_PROMPTS = [
  {
    title: "XZ Utils Blast Radius",
    prompt: "Analyze the blast radius of CVE-2024-3094 on our bastion hosts and show lateral movement risks.",
    category: "Critical Triage"
  },
  {
    title: "ISO 27001 Executive Brief",
    prompt: "Generate an executive remediation plan for unresolved high-severity vulnerabilities to satisfy ISO 27001 A.12.6.1.",
    category: "Compliance"
  },
  {
    title: "BOLA API Remediation",
    prompt: "How should our engineering team remediate the Broken Object Level Authorization finding in the billing API?",
    category: "AppSec Fix"
  },
  {
    title: "Recurring Vulnerabilities",
    prompt: "Which vulnerabilities have persisted across the last 3 quarterly penetration tests, and why?",
    category: "Trend Analysis"
  }
];

export const MOCK_AI_RESPONSES = {
  "blast radius": {
    content: `### Blast Radius Analysis: Bastion Host Architecture

Primary jumpbox **\`bastion-us-east-prod-01\`** connects 3 critical network zones:
- Public DMZ: Port 22 open via AWS Security Group \`sg-08f321ba99\` (Restricted to corporate VPN range)
- Private Production VPC: Direct peering to \`vpc-018244bb\` containing 14 production microservices
- Kubernetes VPC: Direct connection to EKS cluster nodes running customer data workloads

#### Exploitation Pathway:
\`\`\`text
Internet [Adversary]
      | (Crafted SSH Handshake)
      v
[bastion-us-east-prod-01]  <-- Compromised via CVE-2024-3094
      |
      +--> AWS Metadata Service (IMDSv2) -> Role: BastionAdminRole
      |        +--> List Secrets in AWS Secrets Manager
      |        +--> EKS kubectl cluster-admin privilege escalation
      |
      +--> Production RDS Subnet (10.240.24.0/22)
               +--> Aurora PostgreSQL Customer DB (Exfiltration vector)
\`\`\`

#### Immediate Defensive Actions:
1. Revoke the Bastion IAM role token cache: \`aws iam put-role-policy\` to enforce zero trust.
2. Restrict Security Group ingress strictly to the SecOps VPN IP: \`198.51.100.4/32\`.
3. Isolate the bastion container to a temporary quarantine subnet during patching.`,
    citations: [
      {
        source: "PwC_ThreatLens_Infra_PenTest_Q3_2026.pdf",
        section: "Appendix C: VPC Peering Routing Topology",
        cve: "CVE-2024-3094",
        relevance: "Confirms non-segmented route tables between Bastion and Aurora subnets"
      },
      {
        source: "AWS CIS Benchmark v2.0",
        section: "Control 5.1: Ensure VPC peering connections do not bypass firewall controls",
        cve: "CIS-AWS-5.1",
        relevance: "Recommends micro-segmentation and security group quarantine"
      }
    ]
  },
  "iso 27001": {
    content: `### Executive Remediation Plan for ISO 27001:2022 (Control A.12.6.1)

Control Objective: Management of technical vulnerabilities to prevent unauthorized exploitation of published software flaws.

#### Executive Summary:
Currently, the environment has 18 Critical and 45 High vulnerabilities. To satisfy external certification audits scheduled for next month, the following prioritized timeline is mandated:

| Phase | Target Scope | SLA | Responsible Lead |
|---|---|---|---|
| Phase 1: Zero-Day & RCE | CVE-2024-3094 (XZ Utils) & CVE-2023-4863 (WebP) | < 24 Hours | Marcus Vance (DevSecOps) |
| Phase 2: Authorization Flaws | CVE-2023-38606 (BOLA in Billing API) | < 5 Days | Priya Nair (AppSec) |
| Phase 3: Host Hardening | Outdated TLS ciphers & weak DHE params | < 14 Days | David Chen (IT Sec) |

#### Compliance Requirements:
- Automated vulnerability scanner integrated into CI/CD pipeline (Trivy / Snyk)
- Documented evidence of patch validation in staging prior to production deployment
- Formal Risk Acceptance signed by CISO for legacy \`document-archive-engine-v1\` (zlib overflow)`,
    citations: [
      {
        source: "CrowdStrike_Endpoint_Fleet_Compliance.docx",
        section: "Section 2.1: ISO 27001 Gap Matrix",
        cve: "ISO-A.12.6.1",
        relevance: "Identifies SLA violation on 4 high-severity container images"
      },
      {
        source: "KPMG_API_Vulnerability_Report_v2.pdf",
        section: "Executive Compliance Attestation",
        cve: "SOC2-CC7.1",
        relevance: "Requires formal sign-off for open API authorization findings"
      }
    ]
  },
  "bola": {
    content: `### Remediation Procedure: Broken Object Level Authorization (BOLA)

Finding: TL-FIND-1078 / CVE-2023-38606  
Target: \`api.threatlens.io/v2/users/{id}/billing\`

#### Root Cause:
The billing controller retrieves the customer entity solely using the user-supplied \`{id}\` URL parameter without validating whether the requesting JWT claims possess authorization for that specific \`tenant_id\`.

#### Mandatory Code Fix (TypeScript Express Middleware):
\`\`\`typescript
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors';

export const verifyTenantAccess = (req: Request, res: Response, next: NextFunction) => {
  const tokenTenantId = req.user?.tenantId;
  const requestedOrgId = req.params.id;

  if (!tokenTenantId || tokenTenantId !== requestedOrgId) {
    logger.warn({
      event: 'BOLA_ATTEMPT_DETECTED',
      userId: req.user?.id,
      attemptedTenant: requestedOrgId,
      sourceIp: req.ip
    });
    return next(new ForbiddenError('Access denied to specified organizational tenant'));
  }

  next();
};

router.get('/v2/users/:id/billing', authenticateJWT, verifyTenantAccess, getBillingDetails);
\`\`\`

#### Verification Test:
Run an automated test passing an ID of a different tenant while signed in with a valid user token; ensure a 403 Forbidden status code is returned with no response body.`,
    citations: [
      {
        source: "KPMG_API_Vulnerability_Report_v2.pdf",
        section: "Page 14: PoC Request/Response Trace",
        cve: "CVE-2023-38606",
        relevance: "Shows successful unauthorized cross-tenant retrieval of invoice #INV-8891"
      },
      {
        source: "OWASP API Security Top 10 (2023)",
        section: "API1:2023 - Broken Object Level Authorization",
        cve: "OWASP-API1",
        relevance: "Standard mitigation guidance and defense-in-depth authorization patterns"
      }
    ]
  },
  "recurring": {
    content: `### Longitudinal Trend Analysis: Recurring Vulnerabilities

Analysis of reports across Q1, Q2, and Q3 2026 revealed 4 persistent vulnerability patterns:

1. Broken Object Level Authorization (BOLA):
   - Frequency: Detected in 4 distinct audits
   - Driver: Rapid microservice feature velocity without unified authorization middleware
   - Status: Remediations currently underway in Sprint 44

2. Over-permissive Cloud IAM Role Wildcards:
   - Frequency: Detected in 5 separate reports
   - Driver: Development templates utilizing permissive roles during rapid prototyping

3. Outdated TLS Ciphers & Weak DHE Modulus:
   - Frequency: Detected across 3 external perimeter scans
   - Driver: Reverse proxy container configs not pulling from a standardized corporate baseline

#### Prescribed Governance Action:
Deploy Policy-as-Code (Open Policy Agent / Kyverno) in CI/CD to block pull requests containing wildcard IAM policies or unverified endpoints.`,
    citations: [
      {
        source: "PwC_ThreatLens_Infra_PenTest_Q3_2026.pdf",
        section: "Section 6: Multi-Year Comparison",
        cve: "TREND-Q1-Q3",
        relevance: "Documents recurring finding rate decreased by 18% overall but persisted in API routes"
      },
      {
        source: "ThreatLens Perimeter Surface Report",
        section: "SSL/TLS Baseline Comparison",
        cve: "INFO-CIPHERS",
        relevance: "Matches findings across 3 consecutive scans dating back 180 days"
      }
    ]
  }
};
