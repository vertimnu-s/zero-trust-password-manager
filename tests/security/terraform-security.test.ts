// @vitest-environment node

/**
 * Terraform Security Validation
 *
 * Static analysis of Terraform HCL files to verify zero-trust security controls
 * are correctly configured. This runs locally with zero AWS cost.
 *
 * Checks:
 *   1. IAM policies follow least-privilege (no wildcard actions/resources)
 *   2. S3 buckets enforce public access blocks
 *   3. DynamoDB encryption is enabled
 *   4. Lambda security headers are present
 *   5. WAF rules are configured
 *   6. Cognito password policy is enforced
 *   7. No secrets/credentials hardcoded in Terraform files
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const TERRAFORM_DIR = resolve(__dirname, '../../terraform')

function readTfFile(relativePath: string): string {
  const fullPath = join(TERRAFORM_DIR, relativePath)
  if (!existsSync(fullPath)) return ''
  return readFileSync(fullPath, 'utf-8')
}

function readAllTfFiles(dir: string): string {
  const fullDir = join(TERRAFORM_DIR, dir)
  if (!existsSync(fullDir)) return ''
  return readdirSync(fullDir)
    .filter((f) => f.endsWith('.tf'))
    .map((f) => readFileSync(join(fullDir, f), 'utf-8'))
    .join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. IAM Least-Privilege
// ═══════════════════════════════════════════════════════════════════════════

describe('Terraform: IAM Least-Privilege', () => {
  const iamContent = readAllTfFiles('modules/iam')

  it('no wildcard (*) in IAM Action fields', () => {
    // Extract Action arrays — look for "Action = ["*"]" or "Action = "*""
    const wildcardAction = /Action\s*=\s*(\[?\s*"\*"\s*\]?|\"\*\")/g
    expect(iamContent).not.toMatch(wildcardAction)
  })

  it('no wildcard (*) in IAM Resource fields (except CloudWatch logs)', () => {
    // CloudWatch log ARNs conventionally use wildcards; all others should not
    const lines = iamContent.split('\n')
    const resourceLines = lines.filter(
      (l) => l.includes('Resource') && l.includes('"*"') && !l.includes('logs:'),
    )
    // Filter out CloudWatch log resource patterns
    const nonLogWildcards = resourceLines.filter(
      (l) => !l.includes('log-group') && !l.includes('logs'),
    )
    expect(nonLogWildcards).toHaveLength(0)
  })

  it('each Lambda function has its own dedicated IAM role', () => {
    const roleNames = iamContent.match(/resource\s+"aws_iam_role"\s+"(\w+)"/g) || []
    // Should have at least 4 roles (create, read, update, delete)
    expect(roleNames.length).toBeGreaterThanOrEqual(4)
  })

  it('IAM roles only trust lambda.amazonaws.com', () => {
    const trustPolicies = iamContent.match(/Service\s*=\s*"([^"]+)"/g) || []
    trustPolicies.forEach((p) => {
      expect(p).toContain('lambda.amazonaws.com')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. S3 Security
// ═══════════════════════════════════════════════════════════════════════════

describe('Terraform: S3 Security', () => {
  const s3Content = readAllTfFiles('modules/s3')

  it('public access is fully blocked', () => {
    expect(s3Content).toContain('block_public_acls       = true')
    expect(s3Content).toContain('block_public_policy     = true')
    expect(s3Content).toContain('ignore_public_acls      = true')
    expect(s3Content).toContain('restrict_public_buckets = true')
  })

  it('server-side encryption is enabled', () => {
    expect(s3Content).toContain('apply_server_side_encryption_by_default')
    // KMS or AES256
    expect(s3Content).toMatch(/sse_algorithm\s.*?(aws:kms|AES256)/)
  })

  it('bucket versioning is configured', () => {
    expect(s3Content).toContain('aws_s3_bucket_versioning')
  })

  it('lifecycle policy enforces log retention', () => {
    expect(s3Content).toContain('aws_s3_bucket_lifecycle_configuration')
    expect(s3Content).toContain('expiration')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. DynamoDB Security
// ═══════════════════════════════════════════════════════════════════════════

describe('Terraform: DynamoDB Security', () => {
  const dynamoContent = readAllTfFiles('modules/dynamodb')

  it('server-side encryption is enabled', () => {
    expect(dynamoContent).toContain('server_side_encryption')
    expect(dynamoContent).toMatch(/enabled\s*=/)
  })

  it('point-in-time recovery is configured', () => {
    expect(dynamoContent).toContain('point_in_time_recovery')
  })

  it('uses partition key "userId" for tenant isolation', () => {
    expect(dynamoContent).toContain('hash_key')
    expect(dynamoContent).toContain('"userId"')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Lambda Security Headers
// ═══════════════════════════════════════════════════════════════════════════

describe('Terraform: Lambda Security Headers', () => {
  const lambdaDir = join(TERRAFORM_DIR, 'lambda-functions')

  it('all Lambda handlers include security headers', () => {
    const requiredHeaders = [
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Cache-Control',
    ]

    const handlers = ['create-password', 'read-passwords', 'update-password', 'delete-password']
    for (const name of handlers) {
      const content = readFileSync(join(lambdaDir, name, 'index.js'), 'utf-8')
      for (const header of requiredHeaders) {
        expect(content, `${name} missing ${header}`).toContain(header)
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. WAF Configuration
// ═══════════════════════════════════════════════════════════════════════════

describe('Terraform: WAF Configuration', () => {
  const wafContent = readAllTfFiles('modules/waf')

  it('WAF Web ACL is defined', () => {
    expect(wafContent).toContain('aws_wafv2_web_acl')
  })

  it('rate limiting rule is configured', () => {
    expect(wafContent).toMatch(/rate/i)
  })

  it('managed rule groups include common exploits protection', () => {
    expect(wafContent).toContain('AWSManagedRulesCommonRuleSet')
  })

  it('SQL injection protection is enabled', () => {
    expect(wafContent).toContain('AWSManagedRulesSQLiRuleSet')
  })

  it('IP reputation rule is configured', () => {
    expect(wafContent).toContain('AWSManagedRulesAmazonIpReputationList')
  })

  it('dynamic IP blocklist is configured (incident response)', () => {
    expect(wafContent).toMatch(/blocked.*ip|ip.*block/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. Cognito Password Policy
// ═══════════════════════════════════════════════════════════════════════════

describe('Terraform: Cognito Security', () => {
  const cognitoContent = readAllTfFiles('modules/cognito')

  it('password policy enforces minimum length', () => {
    expect(cognitoContent).toMatch(/minimum_length\s*=/)
  })

  it('password policy requires mixed case', () => {
    expect(cognitoContent).toMatch(/require_lowercase\s*=\s*true/)
    expect(cognitoContent).toMatch(/require_uppercase\s*=\s*true/)
  })

  it('password policy requires numbers', () => {
    expect(cognitoContent).toMatch(/require_numbers\s*=\s*true/)
  })

  it('password policy requires symbols', () => {
    expect(cognitoContent).toMatch(/require_symbols\s*=\s*true/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. No Hardcoded Secrets
// ═══════════════════════════════════════════════════════════════════════════

describe('Terraform: No Hardcoded Secrets', () => {
  it('no AWS access keys in any .tf file', () => {
    const allTf = [
      'main.tf', 'variables.tf', 'outputs.tf', 'provider.tf',
    ].map((f) => readTfFile(f)).join('\n')
      + readAllTfFiles('modules/iam')
      + readAllTfFiles('modules/lambda')
      + readAllTfFiles('modules/cognito')

    // AWS access key pattern: AKIA followed by 16 uppercase alphanumeric chars
    expect(allTf).not.toMatch(/AKIA[A-Z0-9]{16}/)
    // AWS secret key: 40 chars base64-like
    expect(allTf).not.toMatch(/[A-Za-z0-9/+=]{40}(?=\s|"|$)/)
  })

  it('no passwords or secrets in terraform.tfvars', () => {
    const tfvars = readTfFile('terraform.tfvars')
    expect(tfvars).not.toMatch(/password\s*=\s*"[^"]+"/i)
    expect(tfvars).not.toMatch(/secret\s*=\s*"[^"]+"/i)
    expect(tfvars).not.toMatch(/AKIA[A-Z0-9]{16}/)
  })
})
