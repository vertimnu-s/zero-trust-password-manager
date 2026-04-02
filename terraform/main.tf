# Root Module - This orchestrates all infrastructure components
# Each module represents a major AWS service

# 1. COGNITO MODULE - User authentication & authorization
module "cognito" {
  source = "./modules/cognito"

  project_name                = var.project_name
  environment                 = var.environment
  password_min_length         = var.cognito_password_min_length
  mfa_enabled                 = var.cognito_mfa_enabled
  enable_passkeys             = var.cognito_enable_passkeys
  
  # Optional: Add field for preferred_username and email
  required_attributes = ["email", "preferred_username"]
}

# 2. DYNAMODB MODULE - Password storage (encrypted in transit + at rest)
module "dynamodb" {
  source = "./modules/dynamodb"

  project_name                = var.project_name
  environment                 = var.environment
  billing_mode                = var.dynamodb_billing_mode
  point_in_time_recovery      = var.enable_point_in_time_recovery
}

# 3. IAM MODULE - Least-privilege policies for Lambda functions
module "iam" {
  source = "./modules/iam"

  project_name                = var.project_name
  environment                 = var.environment
  dynamodb_table_arn          = module.dynamodb.table_arn
  dynamodb_table_name         = module.dynamodb.table_name
  s3_audit_logs_bucket_arn    = module.s3.audit_logs_bucket_arn
  
  # Depends on S3 being created first
  depends_on = [module.s3]
}

# 4. S3 MODULE - Audit logs storage with lifecycle policies
module "s3" {
  source = "./modules/s3"

  project_name                = var.project_name
  environment                 = var.environment
  enable_versioning           = var.s3_enable_versioning
  audit_logs_retention_days   = var.s3_audit_logs_retention_days
}

# 5. LAMBDA MODULE - 4 functions for CRUD operations (with bug fixes)
module "lambda" {
  source = "./modules/lambda"

  project_name                = var.project_name
  environment                 = var.environment
  
  # Pass IAM roles created in IAM module
  create_lambda_role_arn      = module.iam.create_password_role_arn
  read_lambda_role_arn        = module.iam.read_passwords_role_arn
  update_lambda_role_arn      = module.iam.update_password_role_arn
  delete_lambda_role_arn      = module.iam.delete_password_role_arn
  
  # Pass DynamoDB & S3 for environment variables
  dynamodb_table_name         = module.dynamodb.table_name
  s3_audit_logs_bucket_name   = module.s3.audit_logs_bucket_name
  
  # Lambda configuration
  timeout_seconds             = var.lambda_timeout_seconds
  memory_mb                   = var.lambda_memory_mb
  
  # Pass log group names for CloudWatch integration
  create_log_group_name       = module.cloudwatch.create_log_group_name
  read_log_group_name         = module.cloudwatch.read_log_group_name
  update_log_group_name       = module.cloudwatch.update_log_group_name
  delete_log_group_name       = module.cloudwatch.delete_log_group_name
  
  # Depends on IAM and CloudWatch being ready
  depends_on = [module.iam, module.cloudwatch]
}

# 6. API GATEWAY MODULE - HTTP API with JWT authorizer
module "api_gateway" {
  source = "./modules/api_gateway"

  project_name                = var.project_name
  environment                 = var.environment
  api_stage_name              = var.api_stage_name
  
  # CORS configuration
  frontend_origin             = var.frontend_origin
  
  # Pass Lambda function information for integration
  create_lambda_function_arn  = module.lambda.create_password_function_arn
  read_lambda_function_arn    = module.lambda.read_passwords_function_arn
  update_lambda_function_arn  = module.lambda.update_password_function_arn
  delete_lambda_function_arn  = module.lambda.delete_password_function_arn
  
  # Pass Cognito User Pool for JWT authorizer
  cognito_user_pool_id        = module.cognito.user_pool_id
  cognito_user_pool_arn       = module.cognito.user_pool_arn
  
  # Pass Lambda invoke permissions
  lambda_create_invoke_permission = module.lambda.create_password_invoke_permission
  lambda_read_invoke_permission   = module.lambda.read_passwords_invoke_permission
  lambda_update_invoke_permission = module.lambda.update_password_invoke_permission
  lambda_delete_invoke_permission = module.lambda.delete_password_invoke_permission
  
  # Depends on Lambda and Cognito being ready
  depends_on = [module.lambda, module.cognito]
}

# 7. CLOUDWATCH MODULE - Logging and monitoring
module "cloudwatch" {
  source = "./modules/cloudwatch"

  project_name                = var.project_name
  environment                 = var.environment
}
