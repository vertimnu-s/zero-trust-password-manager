# Terraform Variables - Optimized for AWS Free Tier ($120 budget)
# https://aws.amazon.com/free/

aws_region    = "eu-north-1"
project_name  = "zero-trust-password-manager"
environment   = "dev"

# Frontend URL 
frontend_origin = "http://localhost:5173"

api_stage_name = "dev"

# ========== COGNITO CONFIGURATION ==========
# Free tier: 50,000 monthly active users (plenty for dissertation!)
cognito_password_min_length = 12
cognito_mfa_enabled         = true
cognito_enable_passkeys     = true

# ========== DYNAMODB CONFIGURATION ==========
# Free tier: 25GB on-demand per month (included in $120)
# PAY_PER_REQUEST: No provisioned capacity charges, scales to 0
dynamodb_billing_mode           = "PAY_PER_REQUEST"  
enable_point_in_time_recovery   = false             

# ========== LAMBDA CONFIGURATION ==========
# Free tier: 1,000,000 requests/month + 3,200,000 GB-seconds (VERY generous!)
lambda_timeout_seconds = 30     # Default is fine
lambda_memory_mb       = 256    # 256MB is minimum; perfect for password manager ops

# ========== S3 CONFIGURATION ==========
# Free tier: 5GB storage for first 12 months + 20,000 GET/PUT operations
s3_enable_versioning          = false              
s3_audit_logs_retention_days  = 30                 

# ========== PAID SECURITY SERVICES ==========
# Flip this ONE variable to enable/disable ALL paid services (WAF, GuardDuty, CloudTrail).
# Cost when enabled: ~$12/month. Set to false when not testing to save credits.
enable_paid_security = true

security_alert_email   = "aververaki@athtech.gr"

# Additional tags for cost tracking
additional_tags = {
  CostCenter          = "Education"
  Dissertation        = "true"
  DataClassification  = "Sensitive"
  FreeTierOptimized   = "true"
  Budget              = "120 USD"
}
