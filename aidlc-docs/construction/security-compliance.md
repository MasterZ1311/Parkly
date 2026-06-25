# Parkly — Security Baseline Compliance Summary (Pragmatic)

Security Baseline enabled with pragmatic application (user choice "X").
Status per rule for the MVP scaffold:

| Rule | Status | Notes |
|---|---|---|
| SECURITY-01 Encryption at rest/in transit | Compliant | CDK: KMS CMK for RDS/DynamoDB/S3; S3 `enforceSSL`; RDS `storageEncrypted` |
| SECURITY-02 Access logging on intermediaries | Compliant | VPC flow logs; EventBridge catch-all to CloudWatch; API GW access logs to wire on deploy |
| SECURITY-03 Application logging | Compliant | `shared/logger.ts` structured + correlation id + redaction |
| SECURITY-04 HTTP security headers | Compliant | `shared/middleware.ts` securityHeaders on gateway + services |
| SECURITY-05 Input validation | Compliant | zod schemas + body size limits on every endpoint |
| SECURITY-06 Least-privilege IAM | Partial | CDK uses scoped constructs; review generated policies before prod |
| SECURITY-07 Restrictive network | Compliant | Private/isolated subnets, NAT (no direct IGW) in network-stack |
| SECURITY-08 App-level access control | Compliant | requireAuth/requireRole/assertOwnership (IDOR protection) |
| SECURITY-09 Hardening/misconfig | Compliant | x-powered-by disabled, generic prod errors, S3 public access blocked |
| SECURITY-10 Supply chain | Compliant | Pinned versions; CI `npm audit` step |
| SECURITY-11 Secure design | Compliant | Rate limiting; security logic isolated in shared/auth |
| SECURITY-12 Auth & credentials | Compliant | OTP hashed, brute-force limits, secrets via env/Secrets Manager, no hardcoded creds |
| SECURITY-13 Integrity verification | Partial | SRI for web CDN scripts and signed artifacts to add at deploy |
| SECURITY-14 Alerting & monitoring | Partial | Log groups + retention defined; CloudWatch alarms to add per environment |
| SECURITY-15 Exception handling | Compliant | Global error handler, fail-closed, async wrappers |

**Partial items** are intentionally deferred to deployment-time configuration and are
documented in `DETAILS_REQUIRED.md`. None are blocking for the local MVP scaffold.
