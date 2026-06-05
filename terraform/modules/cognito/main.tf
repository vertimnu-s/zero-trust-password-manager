resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}"

  password_policy {
    minimum_length    = var.password_min_length
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
    temporary_password_validity_days = 3
  }

  username_attributes = ["email"]
  auto_verified_attributes = ["email"]

  mfa_configuration = var.mfa_enabled ? "OPTIONAL" : "OFF"

  software_token_mfa_configuration {
    enabled = var.mfa_enabled
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }




  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"  # Detects suspicious signin activity
  }

  tags = {
    Name = "${var.project_name}-user-pool"
  }

  device_configuration {
    challenge_required_on_new_device      = var.mfa_enabled
    device_only_remembered_on_user_prompt = true
  }

  lifecycle {
    ignore_changes = [schema]
  }
}

resource "aws_cognito_user_pool_client" "frontend" {
  name            = "${var.project_name}-client"
  user_pool_id    = aws_cognito_user_pool.main.id
  
  
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",      # Standard login
    "ALLOW_REFRESH_TOKEN_AUTH",       # Token refresh
    "ALLOW_USER_SRP_AUTH",            # Secure password hash flow (recommended)
    "ALLOW_CUSTOM_AUTH"               # For additional security flows
  ]

  generate_secret = false  # Frontend apps typically don't use client secret

  access_token_validity = 1    # hours
  id_token_validity     = 1    # hours
  refresh_token_validity = 30  # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"

  enable_token_revocation = true

  supported_identity_providers = ["COGNITO"]

  allowed_oauth_flows = []
  allowed_oauth_scopes = []
}
