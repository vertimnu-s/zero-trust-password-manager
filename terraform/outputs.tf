# Root Module Outputs - These are exported values that you can reference

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID - needed for frontend environment variable VITE_COGNITO_USER_POOL_ID"
  value       = module.cognito.user_pool_id
  sensitive   = false
}

output "cognito_client_id" {
  description = "Cognito App Client ID - needed for frontend environment variable VITE_COGNITO_CLIENT_ID"
  value       = module.cognito.client_id
  sensitive   = false
}

output "api_gateway_api_endpoint" {
  description = "API Gateway HTTP API endpoint - needed for frontend environment variable VITE_API_URL"
  value       = module.api_gateway.api_endpoint
  sensitive   = false
}

output "api_gateway_api_id" {
  description = "API Gateway API ID for reference"
  value       = module.api_gateway.api_id
  sensitive   = false
}

output "dynamodb_table_name" {
  description = "DynamoDB table name for password vault"
  value       = module.dynamodb.table_name
  sensitive   = false
}

output "s3_audit_logs_bucket_name" {
  description = "S3 bucket name for storing audit logs"
  value       = module.s3.audit_logs_bucket_name
  sensitive   = false
}

output "lambda_create_function_name" {
  description = "Lambda function name for creating passwords"
  value       = module.lambda.create_password_function_name
  sensitive   = false
}

output "lambda_read_function_name" {
  description = "Lambda function name for reading passwords"
  value       = module.lambda.read_passwords_function_name
  sensitive   = false
}

output "lambda_update_function_name" {
  description = "Lambda function name for updating passwords"
  value       = module.lambda.update_password_function_name
  sensitive   = false
}

output "lambda_delete_function_name" {
  description = "Lambda function name for deleting passwords"
  value       = module.lambda.delete_password_function_name
  sensitive   = false
}

output "cloudwatch_log_groups" {
  description = "CloudWatch Log Group names for all Lambda functions"
  value       = module.cloudwatch.log_group_names
  sensitive   = false
}

# Frontend Environment Variables Summary
output "frontend_env_variables" {
  description = "Environment variables needed for the frontend .env file"
  value = {
    VITE_API_URL             = module.api_gateway.api_endpoint
    VITE_COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    VITE_COGNITO_CLIENT_ID    = module.cognito.client_id
  }
  sensitive = false
}

# WAF & CloudFront outputs
output "waf_web_acl_name" {
  description = "WAF Web ACL name protecting the API"
  value       = module.waf.web_acl_name
  sensitive   = false
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (WAF-protected API layer)"
  value       = module.waf.cloudfront_distribution_id
  sensitive   = false
}

output "cloudfront_api_endpoint" {
  description = "WAF-protected API endpoint via CloudFront (use this instead of direct API Gateway URL)"
  value       = module.waf.cloudfront_api_endpoint
  sensitive   = false
}

output "waf_protected_frontend_env" {
  description = "Frontend env using WAF-protected endpoint (recommended for production)"
  value = {
    VITE_API_URL             = module.waf.cloudfront_api_endpoint
    VITE_COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    VITE_COGNITO_CLIENT_ID    = module.cognito.client_id
  }
  sensitive = false
}

# Security monitoring outputs
output "guardduty_detector_id" {
  value     = module.security_monitoring.guardduty_detector_id
  sensitive = false
}

output "security_alerts_sns_topic" {
  value     = module.security_monitoring.sns_topic_arn
  sensitive = false
}

output "cloudtrail_s3_bucket" {
  value     = module.cloudtrail.trail_s3_bucket
  sensitive = false
}

output "kms_dynamodb_key_id" {
  value     = module.kms.dynamodb_key_id
  sensitive = false
}

output "kms_s3_key_id" {
  value     = module.kms.s3_key_id
  sensitive = false
}

output "security_hub_id" {
  value     = module.compliance.security_hub_id
  sensitive = false
}

output "config_recorder_id" {
  value     = module.compliance.config_recorder_id
  sensitive = false
}

output "access_analyzer_arn" {
  value     = module.access_analyzer.analyzer_arn
  sensitive = false
}
