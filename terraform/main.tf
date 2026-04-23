# Root Module - This orchestrates all infrastructure components
# Each module represents a major AWS service

locals {
  waf_enabled        = var.waf_enabled != null ? var.waf_enabled : var.enable_paid_security
  guardduty_enabled  = var.guardduty_enabled != null ? var.guardduty_enabled : var.enable_paid_security
  cloudtrail_enabled = var.cloudtrail_enabled != null ? var.cloudtrail_enabled : var.enable_paid_security
  kms_enabled        = var.kms_enabled != null ? var.kms_enabled : var.enable_paid_security
  compliance_enabled = var.compliance_enabled != null ? var.compliance_enabled : var.enable_paid_security
}

# 1. COGNITO MODULE - User authentication & authorization
module "cognito" {
  source = "./modules/cognito"

  project_name        = var.project_name
  environment         = var.environment
  password_min_length = var.cognito_password_min_length
  mfa_enabled         = var.cognito_mfa_enabled
  enable_passkeys     = var.cognito_enable_passkeys

  # Optional: Add field for preferred_username and email
  required_attributes = ["email", "preferred_username"]
}

# 2. DYNAMODB MODULE - Password storage (encrypted in transit + at rest)
module "dynamodb" {
  source = "./modules/dynamodb"

  project_name           = var.project_name
  environment            = var.environment
  billing_mode           = var.dynamodb_billing_mode
  point_in_time_recovery = var.enable_point_in_time_recovery
  kms_key_arn            = module.kms.dynamodb_key_arn
}

# 3. IAM MODULE - Least-privilege policies for Lambda functions
module "iam" {
  source = "./modules/iam"

  project_name             = var.project_name
  environment              = var.environment
  dynamodb_table_arn       = module.dynamodb.table_arn
  dynamodb_table_name      = module.dynamodb.table_name
  s3_audit_logs_bucket_arn = module.s3.audit_logs_bucket_arn
  kms_key_arns             = local.kms_enabled ? [module.kms.dynamodb_key_arn, module.kms.s3_key_arn] : []
  dlq_arns                 = { for k, v in aws_sqs_queue.lambda_dlq : k => v.arn }

  depends_on = [module.s3]
}

# 3b. KMS MODULE - Customer-managed encryption keys for DynamoDB and S3
module "kms" {
  source = "./modules/kms"

  project_name = var.project_name
  environment  = var.environment
  enabled      = local.kms_enabled
}

# 4. S3 MODULE - Audit logs storage with lifecycle policies
module "s3" {
  source = "./modules/s3"

  project_name              = var.project_name
  environment               = var.environment
  enable_versioning         = var.s3_enable_versioning
  audit_logs_retention_days = var.s3_audit_logs_retention_days
  kms_key_arn               = module.kms.s3_key_arn
}

# 4b. SQS DEAD LETTER QUEUES — capture failed Lambda invocations for investigation
resource "aws_sqs_queue" "lambda_dlq" {
  for_each = toset(["create", "read", "update", "delete"])

  name                      = "${var.project_name}-${each.key}-dlq-${var.environment}"
  message_retention_seconds = 1209600

  tags = { Name = "${var.project_name}-${each.key}-dlq" }
}

# 5. LAMBDA MODULE - 4 functions for CRUD operations (with bug fixes)
module "lambda" {
  source = "./modules/lambda"

  project_name = var.project_name
  environment  = var.environment

  # Pass IAM roles created in IAM module
  create_lambda_role_arn = module.iam.create_password_role_arn
  read_lambda_role_arn   = module.iam.read_passwords_role_arn
  update_lambda_role_arn = module.iam.update_password_role_arn
  delete_lambda_role_arn = module.iam.delete_password_role_arn

  # Pass DynamoDB & S3 for environment variables
  dynamodb_table_name       = module.dynamodb.table_name
  s3_audit_logs_bucket_name = module.s3.audit_logs_bucket_name

  # CORS origin for Lambda responses
  frontend_origin = var.frontend_origin


  # Lambda configuration
  timeout_seconds = var.lambda_timeout_seconds
  memory_mb       = var.lambda_memory_mb

  # Pass log group names for CloudWatch integration
  create_log_group_name = module.cloudwatch.create_log_group_name
  read_log_group_name   = module.cloudwatch.read_log_group_name
  update_log_group_name = module.cloudwatch.update_log_group_name
  delete_log_group_name = module.cloudwatch.delete_log_group_name









  # DLQ ARNs
  dlq_arns = { for k, v in aws_sqs_queue.lambda_dlq : k => v.arn }

  # Depends on IAM and CloudWatch being ready
  depends_on = [module.iam, module.cloudwatch]
}

# 6. API GATEWAY MODULE - HTTP API with JWT authorizer
module "api_gateway" {
  source = "./modules/api_gateway"

  project_name   = var.project_name
  environment    = var.environment
  api_stage_name = var.api_stage_name

  # CORS configuration
  frontend_origin = var.frontend_origin

  # Pass Lambda function information for integration
  create_lambda_function_arn = module.lambda.create_password_function_arn
  read_lambda_function_arn   = module.lambda.read_passwords_function_arn
  update_lambda_function_arn = module.lambda.update_password_function_arn
  delete_lambda_function_arn = module.lambda.delete_password_function_arn

  # Pass Lambda function names for permissions
  create_lambda_function_name = module.lambda.create_password_function_name
  read_lambda_function_name   = module.lambda.read_passwords_function_name
  update_lambda_function_name = module.lambda.update_password_function_name
  delete_lambda_function_name = module.lambda.delete_password_function_name

  # Pass Cognito User Pool for JWT authorizer

  cognito_user_pool_id  = module.cognito.user_pool_id
  cognito_user_pool_arn = module.cognito.user_pool_arn
  cognito_client_id     = module.cognito.client_id

  # CloudWatch for access logging
  api_gateway_log_group_arn = module.cloudwatch.api_gateway_log_group_arn

  # Depends on Lambda and Cognito being ready
  depends_on = [module.lambda, module.cognito]
}

# 7. SECURITY MONITORING — GuardDuty threat detection + SNS email alerts
module "security_monitoring" {
  source = "./modules/security_monitoring"

  project_name = var.project_name
  environment  = var.environment
  enabled      = local.guardduty_enabled
  alert_email  = var.security_alert_email
}

# 8. CLOUDWATCH MODULE - Logging and monitoring
module "cloudwatch" {
  source = "./modules/cloudwatch"

  project_name  = var.project_name
  environment   = var.environment
  sns_topic_arn = local.guardduty_enabled ? module.security_monitoring.sns_topic_arn : null

  depends_on = [module.security_monitoring]
}

# 9. WAF MODULE - Web Application Firewall with CloudFront
module "waf" {
  source = "./modules/waf"

  providers = {
    aws = aws.us_east_1
  }

  project_name           = var.project_name
  environment            = var.environment
  enabled                = local.waf_enabled
  api_gateway_endpoint   = module.api_gateway.api_endpoint_raw
  api_gateway_stage_name = var.api_stage_name
  rate_limit_per_ip      = var.waf_rate_limit_per_ip
  frontend_origin        = var.frontend_origin
  enable_logging         = var.waf_enable_logging
  log_retention_days     = var.waf_log_retention_days
  blocked_ip_set_arn     = (local.guardduty_enabled && local.waf_enabled) ? module.incident_response.waf_ip_set_arn : null

  depends_on = [module.api_gateway]
}

# 10. CLOUDTRAIL — records all AWS API calls for audit and forensics
module "cloudtrail" {
  source = "./modules/cloudtrail"

  project_name          = var.project_name
  environment           = var.environment
  enabled               = local.cloudtrail_enabled
  s3_log_retention_days = 90
}

# 11. COMPLIANCE — Security Hub + AWS Config for CIS/best-practice checks
module "compliance" {
  source = "./modules/compliance"

  project_name = var.project_name

  environment            = var.environment
  enabled                = local.compliance_enabled
  audit_logs_bucket_name = module.s3.audit_logs_bucket_name
  audit_logs_bucket_arn  = module.s3.audit_logs_bucket_arn
  guardduty_enabled      = local.guardduty_enabled

  depends_on = [module.s3, module.security_monitoring]
}

# 12. ACCESS ANALYZER — detects IAM policies granting external access
module "access_analyzer" {
  source = "./modules/access_analyzer"

  project_name = var.project_name
  environment  = var.environment
  enabled      = true
}

# 13. INCIDENT RESPONSE — automated remediation for GuardDuty findings.
# Blocks attacker IPs via WAF IP set and disables compromised Cognito users.
# Cost: $0 — Lambda free tier, WAF IP set included, EventBridge free.
module "incident_response" {
  source = "./modules/incident_response"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  project_name          = var.project_name
  environment           = var.environment
  enabled               = local.guardduty_enabled && local.waf_enabled
  cognito_user_pool_id  = module.cognito.user_pool_id
  cognito_user_pool_arn = module.cognito.user_pool_arn
  sns_topic_arn         = local.guardduty_enabled ? module.security_monitoring.sns_topic_arn : null

  depends_on = [module.security_monitoring, module.cognito]
}
