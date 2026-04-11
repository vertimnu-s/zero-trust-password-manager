# Design and Security Evaluation of a Zero Trust Cloud-Based Password Manager

## Dissertation Structure Draft

**Word budget:** 10,000–12,000 words (±20% buffer = 8,000–14,400 range)
**Target:** ~12,000 words to maximise coverage

Below is a chapter-by-chapter, section-by-section plan. Each section includes what to write, what to reference (from your codebase, AWS config, or literature), and an approximate word allocation.

---

## Chapter 1 — Introduction (~1,200 words)

### 1.1 Background and Motivation (~300 words)
- The password reuse crisis: cite breach statistics (Verizon DBIR, Have I Been Pwned data)
- Why traditional password managers have a trust problem — centralised vaults as single points of failure (cite LastPass 2022 breach, OneLogin 2017, Passwordstate 2021)
- The shift toward Zero Trust as a security paradigm (cite NIST SP 800-207)
- Why cloud-native architectures (serverless) are well-suited to Zero Trust

### 1.2 Problem Definition (~400 words)
Define the problem at three abstraction levels:
- **High level:** Users need to store credentials securely, but existing solutions require trusting a single provider with plaintext access
- **Mid level:** How do you build a password manager where the server never sees plaintext, every request is authenticated, permissions are minimally scoped, and breaches are assumed and mitigated?
- **Low level:** Specific technical challenges — client-side key derivation performance, secure key management in browser memory, JWT session lifecycle, least-privilege IAM in serverless, audit trail integrity

### 1.3 Aims and Objectives (~300 words)
State the overall aim, then list 10 objectives:

1. Investigate Zero Trust principles and their applicability to password management
2. Critically evaluate existing password managers against Zero Trust criteria
3. Design a client-side encryption architecture where the server has zero knowledge of plaintext passwords
4. Implement a serverless backend on AWS using least-privilege IAM policies
5. Implement JWT-based authentication with continuous session validation
6. Apply the "assume breach" principle through rate limiting, audit logging, memory wiping, and security headers
7. Develop a usable frontend that balances security with user experience
8. Deploy the system using Infrastructure as Code (Terraform) for reproducibility
9. Conduct security testing against OWASP Top 10 and Zero Trust criteria
10. Evaluate the system against all three Zero Trust principles with evidence-based assessment

### 1.4 Scope and Constraints (~200 words)
- In scope: web-based SPA, AWS serverless backend, client-side AES-256-GCM encryption, Cognito auth, Terraform IaC
- Out of scope: mobile apps, browser extension, multi-device sync conflict resolution, offline mode, passkey/WebAuthn (planned but not implemented), MFA UI (Cognito supports it but frontend flow not built)
- Constraints: AWS Free Tier budget, single-region deployment, dissertation timeline

---

## Chapter 2 — Literature Review (~2,000 words)

### 2.1 Password Management: The Current Landscape (~400 words)
- How password managers work (vault encryption, master password derivation)
- Categories: local-only (KeePass), cloud-synced (Bitwarden, 1Password), browser-built-in
- The trust model problem: most cloud managers decrypt on the server or hold encryption keys server-side
- **Comparison table:** KeePass vs Bitwarden vs 1Password vs LastPass — columns: encryption model, key custody, server knowledge, breach history, open source, cloud dependency

### 2.2 Zero Trust Architecture (~500 words)
- Origin and evolution: Forrester (Kindervag 2010), Google BeyondCorp, NIST SP 800-207
- The three principles: (1) Verify explicitly, (2) Least privilege access, (3) Assume breach
- How Zero Trust differs from perimeter-based security
- Zero Trust applied to application architecture (not just network security)
- Discuss: Zero Trust is typically discussed for enterprise networks — justify its application to an end-user application

### 2.3 Cryptographic Foundations (~400 words)
- Symmetric encryption: AES-GCM (authenticated encryption with associated data)
- Key derivation: PBKDF2 vs Argon2 vs scrypt — justify PBKDF2 choice (Web Crypto API availability, 100K iterations, NIST SP 800-132)
- **Trade-off table:** PBKDF2 vs Argon2 vs scrypt — columns: browser support, memory hardness, GPU resistance, standardisation
- Client-side vs server-side encryption: why zero-knowledge matters
- The role of salt, IV, and additional authenticated data (AAD) in preventing attack classes

### 2.4 Serverless Security on AWS (~400 words)
- AWS shared responsibility model
- Cognito as an identity provider: JWT lifecycle, token expiry, advanced security features
- API Gateway as a policy enforcement point (JWT authorizer, throttling, CORS)
- Lambda security: execution isolation, IAM role scoping, cold start implications
- DynamoDB: encryption at rest, partition key design for tenant isolation
- **Comparison table:** serverless vs traditional server deployment — columns: attack surface, scaling, patching, cost, cold start latency

### 2.5 Infrastructure as Code and Security (~300 words)
- Terraform as a declarative security tool: reproducibility, auditability, drift detection
- IaC benefits for Zero Trust: every permission is codified, reviewable, version-controlled
- Risks: secrets in state files, overly broad defaults
- Cite: HashiCorp Terraform docs, NIST DevSecOps guidance

---

## Chapter 3 — Methodology (~1,000 words)

### 3.1 Software Development Process (~400 words)
- Name and describe the SDP used (likely iterative/incremental or agile-inspired)
- Justify the choice: why this SDP suits a solo developer, security-focused project with evolving requirements
- Describe the iterations: (1) infrastructure + basic CRUD, (2) encryption + vault logic, (3) UI redesign, (4) security hardening (audit fixes, assume-breach features)
- Provide evidence: reference your Git commit history, the progression of Terraform modules, the audit-then-fix cycle we just completed

### 3.2 Tools and Technologies (~400 words)
This is the section you specifically requested.

**Zero Trust implementation tools:**
- NIST SP 800-207 as the guiding framework
- Three principles mapped to technical controls (provide a mapping table)

**AWS services used and their Zero Trust role:**
| Service | Zero Trust Role |
|---------|----------------|
| Cognito | Verify explicitly — JWT authentication, password policy enforcement, advanced security (adaptive auth) |
| API Gateway | Verify explicitly — JWT authorizer on every route, CORS restriction, throttling, access logging |
| Lambda | Least privilege — each function has its own IAM role scoped to exact DynamoDB actions needed |
| DynamoDB | Least privilege — partition key = userId ensures tenant isolation at data layer |
| IAM | Least privilege — 4 separate roles with minimal permissions, no wildcard actions |
| S3 | Assume breach — server-side audit trail, encrypted at rest (KMS CMK), public access blocked, deny-delete policy on audit logs, Glacier archival after 30 days, 365-day retention |
| CloudWatch | Assume breach — structured logging, API access logs, error alarms with SNS notifications |
| WAF + CloudFront | Verify explicitly / Assume breach — managed rule groups (CRS, SQLi, IP reputation, Known Bad Inputs), per-IP rate limiting, DDoS protection via Shield Standard, security response headers policy |
| GuardDuty | Assume breach — continuous threat detection across CloudTrail, VPC flow logs, DNS; findings routed to SNS |
| SNS + EventBridge | Assume breach — security alert pipeline; GuardDuty findings and CloudWatch alarms trigger email notifications |
| CloudTrail | Assume breach — records all AWS API calls for forensic audit; log file validation detects tampering |
| KMS | Least privilege — customer-managed encryption keys for DynamoDB and S3, annual key rotation, root-account-only key administration |
| SQS | Assume breach — dead letter queues for each Lambda function capture failed invocations for investigation (14-day retention) |
| Security Hub + AWS Config | Assume breach — CIS 1.4.0 and AWS Best Practices compliance checks, daily configuration recording, GuardDuty integration |
| IAM Access Analyzer | Least privilege — account-level analysis of IAM, S3, KMS, Lambda, and SQS policies for unintended external access |
| Terraform | All three — codified infrastructure, auditable permissions, reproducible deployment |

**Frontend stack:**
- React 19, TypeScript, Vite — type safety, fast builds
- Web Crypto API — browser-native cryptographic operations (AES-GCM, PBKDF2)
- CSS Modules — style isolation

### 3.3 Research Methods (~200 words)
- Security evaluation approach: manual testing against OWASP Top 10, code review against Zero Trust criteria
- How you gathered requirements (password manager threat modelling, literature gaps)
- How you validated: functional testing, security testing, Terraform validate/plan

---

## Chapter 4 — System Design (~1,500 words)

### 4.1 Architecture Overview (~300 words)
- High-level architecture diagram: Browser → API Gateway (JWT auth) → Lambda → DynamoDB, with S3 audit logs and CloudWatch monitoring
- Data flow: registration → login → JWT issuance → vault operations → client-side encrypt/decrypt
- Trust boundary diagram: show where client/server boundary is, and why the server never handles plaintext

### 4.2 Threat Model (~400 words)
- Identify threat actors: malicious insider (compromised AWS account), network attacker (MITM), stolen device (browser session), brute-force attacker
- For each: what they can access, what they cannot (because of Zero Trust controls)
- **Table:** Threat vs Mitigation mapping
- Reference STRIDE or similar framework

### 4.3 Data Model Design (~200 words)
- DynamoDB schema: userId (partition key from Cognito sub) + itemKey (sort key = site#username)
- Why composite sort key: prevents duplicates, enables efficient per-user queries
- What is stored: only cipherText, iv, salt, metadata — never plaintext
- Encryption at rest (AWS-managed KMS)

### 4.4 Encryption Design (~300 words)
- Key derivation: master password → PBKDF2 (100K iterations, SHA-256, 16-byte salt) → AES-256 key
- Encryption: AES-256-GCM with 12-byte IV and site name as AAD
- Why AAD matters: binds ciphertext to the site context, prevents ciphertext swapping attacks
- Key lifecycle: derived key exists only in browser memory, no key escrow, no recovery mechanism
- **Trade-off discussion:** no key recovery means lost master password = lost data. This is a deliberate Zero Trust decision — reference 1Password's similar approach

### 4.5 Authentication and Session Design (~300 words)
- Cognito user pool: email-based signup, enforced password policy (12+ chars, mixed case, numbers, symbols), advanced security mode ENFORCED
- Auth flow: USER_PASSWORD_AUTH → JWT (id token + refresh token, 1-hour access/id expiry, 30-day refresh)
- Session validation: client-side JWT expiry check every 30 seconds, auto-logout on expiry, proactive token refresh every 45 minutes
- Token revocation: server-side globalSignOut invalidates all refresh tokens across devices; "Sign Out Everywhere" button on Profile page
- 15-minute inactivity timeout with activity tracking (mouse, keyboard, scroll)
- Password change flow via Cognito changePassword API

---

## Chapter 5 — Implementation (~2,000 words)

### 5.1 Infrastructure Implementation (~500 words)
- Terraform module structure: 14 modules (cognito, dynamodb, iam, kms, lambda, api_gateway, s3, cloudwatch, waf, security_monitoring, cloudtrail, compliance, access_analyzer) plus root-level SQS dead letter queues
- Key implementation decisions with code references:
  - Separate IAM role per Lambda (reference `iam/main.tf` — 4 roles, each with exact DynamoDB actions)
  - API Gateway JWT authorizer on all routes (reference `api_gateway/main.tf`)
  - S3 bucket policy: public access completely blocked (reference `s3/main.tf`)
  - DynamoDB: point-in-time recovery enabled, streams enabled, prevent_destroy lifecycle
  - WAF Web ACL with 5 managed rule groups + per-IP rate limiting, attached via CloudFront distribution with security response headers
  - GuardDuty detector with EventBridge → SNS alert pipeline for medium+ severity findings
  - CloudTrail with log file validation, dedicated encrypted S3 bucket, 90-day retention
  - KMS customer-managed keys for DynamoDB and S3 encryption with annual rotation
  - SQS dead letter queues for all 4 Lambda functions with 14-day message retention
  - Lambda reserved concurrency (10 per function) as a throttle against abuse
  - Security Hub + AWS Config for CIS 1.4.0 and AWS Best Practices compliance checks
  - IAM Access Analyzer for detecting unintended external resource access
  - S3 deny-delete bucket policy on audit logs + Glacier archival lifecycle
  - Master cost toggle (`enable_paid_security`) to enable/disable all paid services atomically
- Show Terraform plan output as evidence of least-privilege

### 5.2 Backend Implementation (~400 words)
- Lambda function structure: one function per CRUD operation
- Input validation: type checking, string length limits, base64 format enforcement, category whitelist (reference the validation code in each Lambda)
- Error handling: generic error messages to client, detailed errors only in CloudWatch
- Server-side audit logging: every operation writes structured JSON to S3 with userId, action, timestamp, success/failure
- Duplicate prevention: ConditionExpression on create (reference create-password Lambda)

### 5.3 Frontend Implementation (~600 words)
- Encryption flow walkthrough: user enters master password → PBKDF2 derives key → AES-GCM encrypts → cipherText/iv/salt sent to API → server stores opaque blob
- Decryption flow: fetch encrypted item → prompt master password → derive key → AES-GCM decrypt with site as AAD → show plaintext → auto-wipe after 2 minutes
- Vault security features:
  - Auto-lock after 5 minutes of inactivity
  - Memory wiping: secureWipeString on lock/timeout
  - Clipboard auto-clear after 30 seconds
  - Failed decryption rate limiting: 5 attempts → 5-minute lockout
- Session integrity: JWT expiry polling every 30 seconds, forced logout
- Input sanitization: sanitizeInput(), validateSite(), validateUsername() before any API call
- Password generator: crypto.getRandomValues() (CSPRNG), not Math.random()

### 5.4 Security Headers (~200 words)
- Content Security Policy: script-src 'self', connect-src restricted to AWS domains
- X-Frame-Options: DENY (clickjacking prevention)
- Strict-Transport-Security: max-age=31536000 with includeSubDomains (HSTS)
- Referrer-Policy, X-Content-Type-Options, Permissions-Policy, Cache-Control: no-store
- Applied at three layers: Lambda CORS headers, CloudFront response headers policy, Vite dev config, and production index.html meta tags

### 5.5 Code Quality and Security Hygiene (~300 words)
- No console.log/error/warn in production code (removed during audit)
- No alert()/prompt() — replaced with toast system and modal flows
- TypeScript for compile-time type safety
- CSS Modules for style isolation (no global CSS pollution)
- No hardcoded secrets — all config via environment variables

---

## Chapter 6 — Deployment (~800 words)

### 6.1 Deployment Pipeline (~300 words)
- Terraform workflow: init → validate → plan → apply
- Lambda deployment: source zipped by Terraform, source_code_hash triggers redeployment on changes
- Frontend: Vite build → static assets (currently local dev; discuss production deployment options: S3 + CloudFront)
- Environment separation via Terraform variables (project_name, environment)
- Cost management: `enable_paid_security` master toggle disables WAF, GuardDuty, and CloudTrail in one variable; individual overrides available for finer control

### 6.2 Infrastructure Configuration Evidence (~300 words)
- Show key Terraform outputs: API URL, Cognito pool ID, DynamoDB table name
- Show `terraform plan` evidence of least-privilege: exact IAM permissions per role
- CORS configuration: API Gateway allows only the specific frontend origin
- Lambda environment variables: no hardcoded origins, dynamic via Terraform variables

### 6.3 Deployment Trade-offs (~200 words)
- Single-region deployment (eu-north-1): cost vs availability trade-off
- AWS-managed KMS vs customer-managed keys: convenience vs key custody
- DynamoDB on-demand billing: cost efficiency for low-traffic vs provisioned performance guarantees
- Cognito MFA: configured as OPTIONAL in Terraform but not implemented in frontend UI — discuss why and acknowledge as limitation

---

## Chapter 7 — Testing (~1,200 words)

### 7.1 Functional Testing (~400 words)
- Test cases for each CRUD operation (create, read, update, delete vault items)
- Test: registration → confirmation → login → vault operations → logout flow
- Test: password change via Profile page
- Test: edit item (same key), edit item (key change — triggers delete+recreate)
- Test: search, filter by category/folder, favorites toggle
- Include screenshots or test result tables

### 7.2 Security Testing (~500 words)
Test against each Zero Trust principle:

**Verify explicitly:**
- Test: unauthenticated API request → 401 response (JWT authorizer blocks it)
- Test: expired JWT → API returns 401, frontend forces logout
- Test: malformed request body → 400 response (input validation catches it)
- Test: invalid base64 in cipherText → rejected before reaching DynamoDB

**Least privilege:**
- Test: Lambda A cannot perform operations granted only to Lambda B (IAM isolation)
- Test: user A cannot read user B's items (DynamoDB partition key = userId)
- Evidence: show IAM policy JSON for each role, highlight what's allowed vs denied

**Assume breach:**
- Test: 5 failed decryption attempts → vault lockout for 5 minutes
- Test: error responses show "Internal server error" not stack traces
- Test: audit logs appear in S3 after each operation
- Test: CSP blocks inline script injection (demonstrate in browser console)
- Test: decrypted passwords auto-clear from memory after 2 minutes
- Test: clipboard auto-clears after 30 seconds

### 7.3 OWASP Top 10 Assessment (~300 words)
**Table:** Map each OWASP Top 10 category to your application:

| OWASP Category | Status | Evidence |
|----------------|--------|----------|
| A01 Broken Access Control | Mitigated | JWT auth on all routes, DynamoDB partition key isolation |
| A02 Cryptographic Failures | Mitigated | AES-256-GCM, PBKDF2 100K iterations, CSPRNG, TLS in transit |
| A03 Injection | Mitigated | Input validation, parameterised DynamoDB queries, CSP, WAF Core Rule Set + SQLi rules |
| A04 Insecure Design | Mitigated | Zero Trust threat model, defence in depth |
| A05 Security Misconfiguration | Mitigated | Terraform IaC, security headers, S3 public access blocked, AWS Config daily recording, Security Hub compliance checks |
| A06 Vulnerable Components | Monitored | npm audit, minimal dependencies |
| A07 Auth Failures | Mitigated | Cognito password policy, WAF per-IP rate limiting, session validation |
| A08 Data Integrity Failures | Mitigated | AES-GCM authentication tag, AAD binding, CloudTrail log file validation |
| A09 Logging & Monitoring | Mitigated | CloudWatch, S3 audit logs, CloudTrail, GuardDuty, SNS alert pipeline, Security Hub, SQS DLQs for failed invocations |
| A10 SSRF | Mitigated | No server-side URL fetching, WAF SSRF rules |

---

## Chapter 8 — Evaluation (~1,800 words)

### 8.1 Evaluation Against Zero Trust Principles (~800 words)
This is the section you specifically requested. Evaluate the system against each principle with evidence.

**Principle 1: Verify Explicitly**
- Every API request authenticated via JWT authorizer (no anonymous routes)
- Session validated continuously (30-second expiry checks)
- All user inputs validated on both client and server
- Master password required for sensitive operations
- Cognito advanced security mode: ENFORCED (adaptive authentication)
- **Evidence:** API Gateway route config, Lambda auth checks, frontend session polling
- **Gap:** no MFA in frontend UI (Cognito supports it, but flow not built)

**Principle 2: Least Privilege Access**
- Each Lambda has a dedicated IAM role with only the exact DynamoDB actions it needs
- No wildcard (*) IAM actions anywhere
- DynamoDB partition key ensures user-level data isolation
- Cognito token scoped to single user identity
- CORS restricted to specific origin
- **Evidence:** IAM policy JSON, DynamoDB key schema, API Gateway CORS config
- KMS customer-managed keys: DynamoDB and S3 encrypted with dedicated CMKs under root-account administration
- IAM Access Analyzer continuously scans resource policies for unintended access
- **Gap:** CloudWatch log permissions use `arn:aws:logs:*:*:log-group:/aws/lambda/*` (scoped to Lambda log groups but not to specific functions)

**Principle 3: Assume Breach**
- Client-side encryption: even a full database compromise reveals only ciphertext
- Generic error messages: no internal details leaked to attackers
- Server-side audit trail: S3 audit logs for forensic analysis
- API Gateway access logging: IP, user agent, path, status on every request
- WAF: 5 rule groups filter malicious traffic at the edge before it reaches application code; per-IP rate limiting returns 429 on abuse; CloudWatch alarms notify via SNS on high block volume
- GuardDuty: continuous threat detection monitors for compromised credentials, unusual API patterns, and reconnaissance; medium+ severity findings routed to email via EventBridge → SNS
- CloudTrail: records every AWS API call with log file validation; stored in dedicated encrypted S3 bucket with 90-day retention; detects infrastructure-level tampering
- CloudFront + Shield Standard: free DDoS protection at the edge, TLS 1.2+ enforcement
- KMS customer-managed keys: DynamoDB and S3 encrypted with dedicated CMKs; annual key rotation; root-account-only administration
- SQS dead letter queues: failed Lambda invocations captured for post-incident analysis (14-day retention)
- Lambda reserved concurrency: capped at 10 per function to prevent abuse and contain blast radius
- S3 audit log protection: deny-delete bucket policy prevents log tampering; Glacier archival after 30 days reduces cost while preserving evidence; 365-day retention
- Security Hub: continuous CIS 1.4.0 and AWS Best Practices compliance checks; aggregates findings from GuardDuty, Config, and Access Analyzer
- AWS Config: daily configuration snapshots of all resources; detects configuration drift
- IAM Access Analyzer: scans all resource policies for unintended external access grants
- Failed decryption lockout: 5 attempts → 5-minute vault freeze + data wipe
- Auto-lock and memory wiping: decrypted data exists in memory for maximum 2 minutes
- Clipboard auto-clear: 30-second window
- Security headers: CSP prevents XSS, X-Frame-Options prevents clickjacking
- CSPRNG for password generation: passwords are cryptographically unpredictable
- DynamoDB point-in-time recovery: can restore data after accidental or malicious deletion
- S3 versioning on audit logs: tamper-evident logging
- Token revocation: server-side globalSignOut invalidates all sessions; refresh token rotation on renewal
- **Evidence:** S3 audit log samples, WAF blocked request metrics, GuardDuty finding screenshots, CloudTrail event samples, security header screenshot, rate limiting test results, Security Hub compliance score, Access Analyzer findings

### 8.2 Objectives Assessment (~500 words)
**Table:** Revisit each of the 10 objectives:

| # | Objective | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Investigate Zero Trust principles | Met | Chapter 2, NIST SP 800-207 analysis |
| 2 | Evaluate existing password managers | Met | Comparison table in §2.1 |
| 3 | Design zero-knowledge encryption | Met | §4.4, AES-256-GCM + PBKDF2 |
| 4 | Implement least-privilege serverless backend | Met | §5.1, 4 IAM roles, Terraform evidence |
| 5 | Implement JWT auth with session validation | Met | §5.3, 30s expiry polling |
| 6 | Apply assume-breach principle | Met | §5.3, §8.1, rate limiting, audit logs, memory wiping |
| 7 | Develop usable frontend | Met | §5.3, UI screenshots |
| 8 | Deploy via IaC | Met | §6.1, Terraform modules |
| 9 | Security testing | Met | §7.2, §7.3, OWASP table |
| 10 | Evaluate against Zero Trust | Met | §8.1 |

### 8.3 Limitations and Threats to Validity (~300 words)
- No automated testing suite (manual testing only)
- MFA configured in Cognito but not exposed in frontend UI
- Single-region deployment — no disaster recovery
- Client-side audit logger is in-memory only (server-side S3 logging compensates)
- PBKDF2 chosen for browser compat, but Argon2 would be more resistant to GPU attacks
- No formal penetration testing — only self-conducted security testing
- secureWipeString is best-effort (JavaScript engines may optimise away memory overwrites)
- Browser localStorage for JWT and refresh tokens — vulnerable to XSS (mitigated by CSP, but httpOnly cookies would be stronger)
- WAF managed rules may produce false positives on encrypted payloads (mitigated by SizeRestrictions_BODY override)
- GuardDuty free trial is 30 days; ongoing monitoring requires paid services (~$1/month)
- CloudTrail data events incur per-event charges (minimal for thesis-scale traffic)
- KMS customer-managed keys add ~$2/month per key; annual rotation is enabled but key deletion window is only 7 days
- Reserved concurrency of 10 per Lambda may throttle under legitimate burst traffic
- S3 deny-delete policy is a software control, not hardware-level WORM (Object Lock unavailable on existing buckets)

### 8.4 Critical Discussion (~200 words)
- Discuss the tension between security and usability (e.g., no key recovery, frequent re-auth)
- Zero Trust in end-user apps vs enterprise networks: is the paradigm a natural fit, or are some principles awkward at the application layer?
- The serverless advantage: reduced attack surface, but increased dependency on cloud provider security

---

## Chapter 9 — Conclusion and Future Work (~500 words)

### 9.1 Conclusion (~250 words)
- Summarise: this project demonstrated that Zero Trust principles can be systematically applied to a consumer password manager
- The three principles mapped to concrete technical controls across the full stack
- The serverless architecture reduced the attack surface while Terraform ensured reproducibility and auditability
- The main achievement: the server has zero knowledge of plaintext passwords at any point

### 9.2 Future Work (~250 words)
- MFA integration in the frontend (Cognito already supports TOTP)
- WebAuthn/passkey support (Terraform variable exists but not implemented)
- Argon2 for key derivation when browser support matures
- Offline mode with encrypted local cache
- Multi-region deployment for availability
- Automated security testing pipeline (SAST/DAST)
- Browser extension for autofill
- Emergency access / trusted contact recovery
- Formal penetration testing by a third party
- S3 Object Lock (WORM) for tamper-proof audit log retention (requires new bucket creation)
- Lambda VPC placement with VPC endpoints for DynamoDB network isolation (cost: ~$32/month for NAT Gateway)
- AWS Config custom rules for application-specific compliance checks
- Secrets Manager for automatic rotation of any application secrets
- Cross-region replication for disaster recovery

---

## References

Key references to include (categorise by topic):

**Zero Trust:**
- NIST SP 800-207 — Zero Trust Architecture (2020)
- Kindervag, J. (2010) — No More Chewy Centers: Introducing The Zero Trust Model (Forrester)
- Google BeyondCorp papers (Ward & Beyer, 2014)
- Rose et al. — NIST SP 800-207 Zero Trust Architecture

**Password Management & Breaches:**
- Verizon Data Breach Investigations Report (latest)
- LastPass Security Incident (2022) — official disclosure
- Bitwarden Security Whitepaper
- 1Password Security Design whitepaper

**Cryptography:**
- NIST SP 800-132 — Recommendation for Password-Based Key Derivation (PBKDF2)
- NIST SP 800-38D — Recommendation for GCM Mode (AES-GCM)
- Percival, C. (2009) — scrypt paper
- Biryukov et al. (2016) — Argon2 specification

**AWS & Serverless:**
- AWS Shared Responsibility Model documentation
- AWS Cognito Developer Guide
- AWS Lambda security best practices
- AWS Well-Architected Framework — Security Pillar

**OWASP:**
- OWASP Top 10 (2021)
- OWASP Application Security Verification Standard (ASVS)

**IaC & DevSecOps:**
- HashiCorp Terraform documentation
- NIST SP 800-204 — Security Strategies for Microservices

**Web Security:**
- MDN Web Docs — Content Security Policy
- MDN Web Docs — Web Crypto API

---

## Appendices

### Appendix A — Full Terraform Configuration
- Include all .tf files (main.tf, modules/) — demonstrates IaC and auditability
- Highlight: 14 modules + root SQS resources, master cost toggle, conditional resource creation

### Appendix B — Lambda Function Source Code
- All four handler files with validation and audit logging

### Appendix C — Frontend Encryption Module
- crypto.ts — full source showing PBKDF2, AES-GCM, CSPRNG, sanitisation

### Appendix D — Security Service Evidence
- WAF Web ACL rule configuration and blocked request metrics
- GuardDuty detector status and sample findings
- CloudTrail event log samples
- SNS alert email samples
- CloudWatch alarm state screenshots
- Security Hub compliance dashboard and CIS benchmark results
- AWS Config resource timeline screenshots
- IAM Access Analyzer findings summary
- KMS key rotation status and policy evidence
- SQS dead letter queue message samples (if any failures captured)

### Appendix D — Security Test Results
- Screenshots of test cases from §7.2
- S3 audit log samples
- API Gateway access log samples
- Browser DevTools showing security headers

### Appendix E — IAM Policy Evidence
- Full JSON of all 4 IAM role policies
- Terraform plan output showing permissions

---

## Word Budget Summary

| Chapter | Topic | Words |
|---------|-------|-------|
| 1 | Introduction | ~1,200 |
| 2 | Literature Review | ~2,000 |
| 3 | Methodology | ~1,000 |
| 4 | System Design | ~1,500 |
| 5 | Implementation | ~2,000 |
| 6 | Deployment | ~800 |
| 7 | Testing | ~1,200 |
| 8 | Evaluation | ~1,800 |
| 9 | Conclusion | ~500 |
| **Total** | | **~12,000** |

Note: Appendices, references, figures, and tables typically do not count toward the word limit. Put large code listings and full test evidence in appendices.
