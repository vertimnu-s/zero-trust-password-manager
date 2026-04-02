# Zero-Trust Password Manager - Terraform Infrastructure Documentation

## Overview

This Terraform configuration deploys a complete, production-grade serverless infrastructure for the Zero-Trust Password Manager on AWS. It implements:

- **User Authentication**: AWS Cognito with MFA and passkeys support
- **API Gateway**: HTTP API with JWT authorizer for request validation
- **Lambda Functions**: 4 serverless functions for CRUD operations (with bug fixes)
- **Database**: DynamoDB with point-in-time recovery and encryption
- **Security**: Least-privilege IAM policies for each Lambda function
- **Audit Trail**: S3 bucket for storing audit logs with lifecycle management
- **Monitoring**: CloudWatch logs and alarms for all components

## Architecture Diagram

```
┌─────────────────┐
│   Frontend      │
│  (React App)    │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────────────────┐
│  API Gateway (HTTP API)         │
│  - JWT Authorizer (Cognito)     │
│  - Native CORS Support          │
│  - Payload Format 2.0           │
└──┬──────┬────────┬──────────┬──┘
   │      │        │          │
   ▼      ▼        ▼          ▼
 CREATE READ   UPDATE    DELETE
 Lambda Lambda Lambda   Lambda
   │      │        │          │
   └──────┴────────┴──────────┘
         │ DynamoDB
         ▼
    ┌──────────────┐
    │   DynamoDB   │
    │  Password    │
    │  Vault       │
    │  (Encrypt    │
    │   at rest)   │
    └──────────────┘

   Cognito User Pool
   (Authentication)
         │
         ▼
   Verifies JWT
   Tokens

   S3 Audit Logs Bucket
   (Lifecycle: 30d→Glacier, 90d→Delete)

   CloudWatch
   (Logs & Alarms)
```

## File Structure

```
terraform/
├── provider.tf                    # AWS provider configuration
├── variables.tf                   # Input variables with defaults
├── terraform.tfvars               # Variable values (customize these)
├── outputs.tf                     # Root module outputs
├── main.tf                        # Root module orchestration
│
├── modules/
│   ├── cognito/
│   │   ├── variables.tf
│   │   ├── main.tf               # User Pool + App Client + MFA
│   │   └── outputs.tf
│   │
│   ├── dynamodb/
│   │   ├── variables.tf
│   │   ├── main.tf               # PasswordVault table, PITR, encryption
│   │   └── outputs.tf
│   │
│   ├── iam/
│   │   ├── variables.tf
│   │   ├── main.tf               # 4 least-privilege roles + policies
│   │   └── outputs.tf
│   │
│   ├── lambda/
│   │   ├── variables.tf
│   │   ├── main.tf               # 4 Lambda functions with fixes
│   │   └── outputs.tf
│   │
│   ├── api_gateway/
│   │   ├── variables.tf
│   │   ├── main.tf               # HTTP API, JWT authorizer, routes
│   │   └── outputs.tf
│   │
│   ├── s3/
│   │   ├── variables.tf
│   │   ├── main.tf               # Audit logs bucket with lifecycle
│   │   └── outputs.tf
│   │
│   └── cloudwatch/
│       ├── variables.tf
│       ├── main.tf               # Log groups + alarms
│       └── outputs.tf
│
└── lambda-functions/
    ├── create-password/index.js
    ├── read-passwords/index.js
    ├── update-password/index.js   # BUG FIX: Properly handles composite key
    └── delete-password/index.js
```

## Prerequisites

1. **AWS Account**: With appropriate permissions (Admin for first deployment, then restrict)
2. **Terraform**: Version ≥ 1.0 installed locally
3. **AWS CLI**: Configured with credentials in ~/.aws/credentials
4. **Node.js**: For Lambda functions (AWS SDK already included)

Verify your setup:
```bash
terraform --version
aws sts get-caller-identity
```

## Deployment Instructions

### Step 1: Initialize Terraform

```bash
cd terraform
terraform init
```

This downloads the AWS provider and initializes the working directory.

### Step 2: Review and Customize Variables

Edit `terraform.tfvars` to customize your deployment:

```hcl
aws_region              = "eu-north-1"      # Your AWS region
environment             = "dev"             # Environment name
frontend_origin         = "http://localhost:5173"  # Your frontend URL
cognito_mfa_enabled     = true              # Enable MFA
cognito_enable_passkeys = true              # Enable passkeys
dynamodb_billing_mode   = "PAY_PER_REQUEST" # Flexible billing
```

### Step 3: Validate Configuration

```bash
terraform validate
```

This checks syntax and logic errors.

### Step 4: Plan Deployment

```bash
terraform plan -out=tfplan
```

Review the output to understand what resources will be created/modified.

### Step 5: Apply Configuration

```bash
terraform apply tfplan
```

Wait ~5-10 minutes for deployment to complete.

### Step 6: Get Outputs

```bash
terraform output
```

You'll see outputs like:
- `cognito_user_pool_id` → use for `VITE_COGNITO_USER_POOL_ID`
- `cognito_client_id` → use for `VITE_COGNITO_CLIENT_ID`
- `api_gateway_api_endpoint` → use for `VITE_API_URL`

## Key Module Explanations

### 1. Cognito Module

**What it does**: Manages user authentication, MFA, and passkeys.

**Key resources**:
- `aws_cognito_user_pool`: User authentication service
  - Password policy: 12+ chars, mixed case, numbers, symbols
  - MFA: OPTIONAL (users can enable)
  - Passkeys: FIDO2 WebAuthn support
  - Advanced security: Detects suspicious signings
- `aws_cognito_user_pool_client`: Frontend SDK configuration
  - Auth flows: SRP (Secure Remote Password) + custom
  - 1-hour token validity for security

**Dissertation Rationale**: Demonstrates knowledge of:
- IAM best practices (MFA, passkeys)
- Security tokens (JWT, ID tokens)
- Authentication flows

### 2. DynamoDB Module

**What it does**: Stores encrypted password items with instant scaling.

**Key resources**:
- Partition key: `userId` (Cognito sub claim - unique per user)
- Sort key: `itemKey` (composite of site#username)
- Billing: PAY_PER_REQUEST (only pay for actual usage)
- PITR: Point-in-time recovery (can restore to any time in last 35 days)
- Encryption: AWS managed keys (can upgrade to customer-managed KMS)
- CloudWatch alarms: Monitors throttling

**Dissertation Rationale**: Demonstrates:
- NoSQL database design (partition + sort keys)
- Encryption at rest
- Disaster recovery (PITR)
- On-demand scaling

### 3. IAM Module

**What it does**: Implements least-privilege security for each Lambda.

**Key resources**:
- 4 roles: One for each Lambda function
- Policies grant ONLY necessary DynamoDB operations
  - CREATE: `PutItem` only
  - READ: `Query` + `GetItem` (read-only)
  - UPDATE: `UpdateItem` + `GetItem`
  - DELETE: `DeleteItem` + `GetItem`
- All can write to CloudWatch Logs
- All can write to S3 audit logs

**Dissertation Rationale**: Best security practice:
- Violates DynamoDBFullAccess principle
- Shows you understand role-based access control
- Meets compliance requirements (audit, least privilege)

### 4. Lambda Module

**What it does**: Deploys 4 serverless functions with proper environment variables.

**Key resources**:
- Node.js 20.x runtime
- JSON logging format (CloudWatch Logs Insights compatible)
- Environment variables: TABLE_NAME, ORIGIN, AUDIT_LOG_BUCKET
- Function permissions: Allow API Gateway to invoke

**Bug Fix**: Update Lambda now correctly handles composite DynamoDB key:
```javascript
// BEFORE (BROKEN):
Key: {
  userId: { S: userId },
  userId: { S: userId },  // DUPLICATE!
  itemKey: { S: itemKey }
}

// AFTER (FIXED):
Key: {
  userId: { S: userId },        // Partition key
  itemKey: { S: newItemKey }    // Sort key
}
```

### 5. API Gateway Module

**What it does**: Routes HTTPS requests to Lambda with JWT validation.

**Key resources**:
- HTTP API (not REST API - faster, cheaper, more modern)
- JWT Authorizer: Validates Cognito ID tokens
- 4 routes:
  - `POST /createPasswordItem` → Create Lambda
  - `GET /getPasswordItems` → Read Lambda
  - `PUT /updatePasswordItem` → Update Lambda
  - `DELETE /deletePasswordItem` → Delete Lambda
- Native CORS: No manual CORS headers in Lambda needed
- Payload format 2.0: Simpler Lambda event format (HTTP API specific)

**Dissertation Rationale**: Shows understanding of:
- API design (REST principles)
- JWT authentication
- Request validation
- API security (CORS, rate limiting)

### 6. S3 Module

**What it does**: Stores audit logs with automatic archival and lifecycle.

**Key resources**:
- Block public access (prevents accidental exposure)
- Encryption at rest (AES256)
- Versioning (keeps change history)
- Lifecycle policy:
  - After 30 days: Move to Glacier (85% cheaper)
  - After 90 days: Delete
- Bucket policies: Only Lambda + CloudWatch can write

**Dissertation Rationale**: Demonstrates:
- Compliance/audit trails
- Cost optimization (Glacier archival)
- Data lifecycle management
- Security best practices

### 7. CloudWatch Module

**What it does**: Centralizes logging and creates alarms.

**Key resources**:
- 5 log groups (1 per Lambda + 1 for API Gateway)
- 30-day retention (can adjust)
- CloudWatch Alarms: Alert on Lambda errors
- Optional: Access logging for API Gateway

**Dissertation Rationale**: Shows understanding of:
- Application monitoring
- Observability
- Debugging production systems
- Alerting strategies

## Important Security Notes

### Least-Privilege Principles

Each Lambda has ONLY the permissions it needs. Example:

```terraform
{
  Sid    = "DynamoDBPutItem"
  Effect = "Allow"
  Action = ["dynamodb:PutItem"]      # Only PutItem - not Query, Scan, Delete, etc.
  Resource = arn:aws:dynamodb:...table/PasswordVault
}
```

### Data Encryption

- **In Transit**: All traffic uses HTTPS (API Gateway enforces)
- **At Rest**: DynamoDB encryption + S3 encryption
- **Application Level**: Frontend uses AES-GCM (client-side encryption)

### Audit Trail

- All Lambda operations logged to CloudWatch
- Audit logs stored in S3 with lifecycle management
- CloudWatch Alarms detect errors

## Customization Guide

### Change Region

Edit `terraform.tfvars`:
```hcl
aws_region = "us-east-1"  # Change to your desired region
```

### Increase Lambda Memory

Edit `terraform.tfvars`:
```hcl
lambda_memory_mb = 512  # Increased from default 256
```

### Extend Log Retention

Edit `terraform.tfvars` or module directly:
```hcl
log_retention_days = 60  # Change from default 30
```

### Production Deployment

For production, update:
```hcl
environment = "prod"
frontend_origin = "https://yourdomain.com"
cognito_mfa_enabled = true  # Might want to ENFORCE instead of OPTIONAL
dynamodb_point_in_time_recovery = true  # Critical for prod
```

## Deployment Checklist

- [ ] AWS credentials configured (`aws sts get-caller-identity`)
- [ ] Terraform version ≥ 1.0 (`terraform --version`)
- [ ] `terraform.tfvars` customized with your values
- [ ] `terraform validate` passes without errors
- [ ] `terraform plan` reviewed and understood
- [ ] `terraform apply` completed successfully
- [ ] Outputs saved (copy to frontend `.env` file)
- [ ] Frontend environment variables updated
- [ ] Frontend deployed and tested
- [ ] CloudWatch logs show no errors
- [ ] API Gateway endpoints accessible

## Troubleshooting

### "Access Denied" Errors

Your AWS credentials lack required permissions. Ensure your IAM user has:
- `cognito:*`
- `dynamodb:*`
- `lambda:*`
- `apigateway:*`
- `iam:*` (for creating roles)
- `s3:*`
- `cloudwatch:*`
- `logs:*`

### Lambda Execution Fails

Check CloudWatch Logs:
```bash
aws logs tail /aws/lambda/zero-trust-password-manager-create-password-dev --follow
```

### DynamoDB Provisioning Timeout

DynamoDB can take 3-5 minutes to create. Run `terraform apply` again if it times out.

### CORS Errors

Verify `frontend_origin` in `terraform.tfvars` matches your frontend URL exactly.

## Cost Estimation (Monthly)

For dev environment with light usage:

| Service | Estimated Cost |
|---------|----------------|
| Cognito | $0 (free tier for 50K users) |
| DynamoDB | ~$1-5 (pay-per-request) |
| Lambda | ~$0.20 (free tier: 1M requests) |
| API Gateway | ~$0.35 (free tier: 1M requests) |
| S3 | ~$0.50 (storage + lifecycle) |
| CloudWatch | ~$1-2 (logs) |
| **Total** | **~$2-8/month** |

## Cleanup/Destroy

To remove all resources:

```bash
terraform destroy
```

⚠️ **WARNING**: This deletes everything including:
- DynamoDB table (with prevent_destroy = true, you must override)
- S3 audit logs bucket
- All Lambda functions
- Cognito users
- CloudWatch logs

To override prevent_destroy:
```bash
terraform destroy -auto-approve -target aws_dynamodb_table.password_vault
```

## Next Steps

1. **Deploy**: Follow deployment instructions above
2. **Test**: Check CloudWatch Logs for errors
3. **Integrate Frontend**: Use output values for `.env` file
4. **Enable Production**: Modify `environment` variable for production deployment
5. **Add Monitoring**: Set up SNS alerts for CloudWatch alarms
6. **Backup**: Enable S3 cross-region replication for disaster recovery

## Additional Resources

- [AWS Terraform Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pools.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Lambda Developer Guide](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- [HTTP API vs REST API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html)

---

**Last Updated**: 2026-04-02 | **Terraform Version**: >= 1.0 | **AWS Provider**: >= 5.0
