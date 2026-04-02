# Cognito Module - User Pool and App Client Configuration

# Create the Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}"

  # PASSWORD POLICY - Enforce strong passwords
  password_policy {
    minimum_length    = var.password_min_length
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
    temporary_password_validity_days = 3
  }

  # AUTHENTICATION - Allow both username and email for sign-in
  username_attributes = ["email"]
  auto_verified_attributes = ["email"]

  # MFA CONFIGURATION
  mfa_configuration = var.mfa_enabled ? "OPTIONAL" : "OFF"

  # SOFTWARE TOKEN MFA (authenticator apps like Google Authenticator)
  software_token_mfa_configuration {
    enabled = var.mfa_enabled
  }

  # EMAIL CONFIGURATION - Cognito sends verification codes
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # ACCOUNT RECOVERY - Users can recover their account via email
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # USER ATTRIBUTE CONFIGURATION
  schema {
    name       = "email"
    attribute_data_type = "String"
    mutable    = true
    required   = true
  }

  schema {
    name       = "preferred_username"
    attribute_data_type = "String"
    mutable    = true
    required   = true
  }

  # USER ATTRIBUTE PERMISSIONS - Allow users to update email
  schema {
    name       = "name"
    attribute_data_type = "String"
    mutable    = true
  }

  # AUTO-VERIFY EMAIL - When created via admin API (optional)
  auto_verified_attributes = ["email"]

  # ENABLE SIGN-UP - Self-registration is enabled
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"  # Detects suspicious signin activity
  }

  # TAGS
  tags = {
    Name = "${var.project_name}-user-pool"
  }
}

# Create App Client for the frontend
resource "aws_cognito_user_pool_client" "frontend" {
  name            = "${var.project_name}-client"
  user_pool_id    = aws_cognito_user_pool.main.id
  
  # IMPORTANT: These settings are for frontend SDK usage (not OAuth/OIDC)
  
  # Authentication flows allowed
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",      # Standard login
    "ALLOW_REFRESH_TOKEN_AUTH",       # Token refresh
    "ALLOW_USER_SRP_AUTH",            # Secure password hash flow (recommended)
    "ALLOW_CUSTOM_AUTH"               # For additional security flows
  ]

  # Prevent token exposure in logs
  generate_secret = false  # Frontend apps typically don't use client secret

  # Token validity
  access_token_validity = 1    # hours
  id_token_validity     = 1    # hours
  refresh_token_validity = 30  # days

  # Token unit configuration
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Prevent users from using the same password twice (if implemented)
  prevent_user_existence_errors = "ENABLED"

  # Enable email as username for sign-in
  username_attributes = ["email"]

  # Passkeys support (WebAuthn)
  supported_identity_providers = ["COGNITO"]

  # Allow custom authentication flow if needed
  allowed_oauth_flows = []
  allowed_oauth_scopes = []
}

# Optional: Create a resource server if you want OAuth scopes (for future use)
# This isn't strictly needed for your current setup but good to have for scalability

# Optional: Configure advanced security (device tracking, etc.)
resource "aws_cognito_user_pool_device_configuration" "main" {
  user_pool_id = aws_cognito_user_pool.main.id

  # Remember device for 30 days (reduces MFA prompts)
  challenge_required_on_new_device = var.mfa_enabled  # If MFA enabled, challenge on new device
  device_only_remembered_on_user_prompt = false
}
