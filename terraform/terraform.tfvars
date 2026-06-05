aws_region   = "eu-north-1"
project_name = "zero-trust-password-manager"
environment  = "dev"

frontend_origin = "http://localhost:5173"

api_stage_name = "dev"

cognito_password_min_length = 12
cognito_mfa_enabled         = true
cognito_enable_passkeys     = true

dynamodb_billing_mode         = "PAY_PER_REQUEST"
enable_point_in_time_recovery = false

lambda_timeout_seconds = 30  # Default is fine
lambda_memory_mb       = 256 # 256MB is minimum; perfect for password manager ops

s3_enable_versioning         = false
s3_audit_logs_retention_days = 30

enable_paid_security = true

security_alert_email = "aververaki@athtech.gr"

additional_tags = {
  CostCenter         = "Education"
  Dissertation       = "true"
  DataClassification = "Sensitive"
  FreeTierOptimized  = "true"
  Budget             = "120 USD"
}
