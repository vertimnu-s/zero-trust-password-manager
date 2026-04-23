# Lambda Module - Deploys Lambda functions for password vault operations


data "aws_caller_identity" "current" {}

# ========== ARCHIVE/ZIP LAMBDA SOURCE CODE ==========

data "archive_file" "create_password_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/create-password"
  output_path = "/tmp/create-password.zip"
}

data "archive_file" "read_passwords_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/read-passwords"
  output_path = "/tmp/read-passwords.zip"
}

data "archive_file" "update_password_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/update-password"
  output_path = "/tmp/update-password.zip"
}

data "archive_file" "delete_password_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/delete-password"
  output_path = "/tmp/delete-password.zip"
}



# ========== 1. CREATE PASSWORD LAMBDA ==========
resource "aws_lambda_function" "create_password" {
  filename         = data.archive_file.create_password_zip.output_path
  source_code_hash = data.archive_file.create_password_zip.output_base64sha256
  
  function_name = "${var.project_name}-create-password-${var.environment}"
  role          = var.create_lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  
  timeout     = var.timeout_seconds
  memory_size = var.memory_mb

  reserved_concurrent_executions = var.reserved_concurrency

  dynamic "dead_letter_config" {
    for_each = lookup(var.dlq_arns, "create", null) != null ? [1] : []
    content {
      target_arn = var.dlq_arns["create"]
    }
  }
  
  logging_config {
    log_group            = var.create_log_group_name
    log_format           = "JSON"
  }
  
  environment {
    variables = {
      PASSWORD_TABLE  = var.dynamodb_table_name
      ALLOWED_ORIGIN  = var.frontend_origin
      AUDIT_LOG_BUCKET = var.s3_audit_logs_bucket_name
    }
  }

  tags = {
    Name     = "${var.project_name}-create-password"
    Function = "CreatePassword"
  }
}

# ========== 2. READ PASSWORDS LAMBDA ==========
resource "aws_lambda_function" "read_passwords" {
  filename         = data.archive_file.read_passwords_zip.output_path
  source_code_hash = data.archive_file.read_passwords_zip.output_base64sha256
  
  function_name = "${var.project_name}-read-passwords-${var.environment}"
  role          = var.read_lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  
  timeout     = var.timeout_seconds
  memory_size = var.memory_mb

  reserved_concurrent_executions = var.reserved_concurrency

  dynamic "dead_letter_config" {
    for_each = lookup(var.dlq_arns, "read", null) != null ? [1] : []
    content {
      target_arn = var.dlq_arns["read"]
    }
  }
  
  logging_config {
    log_group  = var.read_log_group_name
    log_format = "JSON"
  }
  
  environment {
    variables = {
      PASSWORD_TABLE  = var.dynamodb_table_name
      ALLOWED_ORIGIN  = var.frontend_origin
      AUDIT_LOG_BUCKET = var.s3_audit_logs_bucket_name
    }
  }

  tags = {
    Name     = "${var.project_name}-read-passwords"
    Function = "ReadPasswords"
  }
}

# ========== 3. UPDATE PASSWORD LAMBDA ==========
resource "aws_lambda_function" "update_password" {
  filename         = data.archive_file.update_password_zip.output_path
  source_code_hash = data.archive_file.update_password_zip.output_base64sha256
  
  function_name = "${var.project_name}-update-password-${var.environment}"
  role          = var.update_lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  
  timeout     = var.timeout_seconds
  memory_size = var.memory_mb

  reserved_concurrent_executions = var.reserved_concurrency

  dynamic "dead_letter_config" {
    for_each = lookup(var.dlq_arns, "update", null) != null ? [1] : []
    content {
      target_arn = var.dlq_arns["update"]
    }
  }
  
  logging_config {
    log_group  = var.update_log_group_name
    log_format = "JSON"
  }
  
  environment {
    variables = {
      PASSWORD_TABLE  = var.dynamodb_table_name
      ALLOWED_ORIGIN  = var.frontend_origin
      AUDIT_LOG_BUCKET = var.s3_audit_logs_bucket_name
    }
  }

  tags = {
    Name     = "${var.project_name}-update-password"
    Function = "UpdatePassword"
  }
}

# ========== 4. DELETE PASSWORD LAMBDA ==========
resource "aws_lambda_function" "delete_password" {
  filename         = data.archive_file.delete_password_zip.output_path
  source_code_hash = data.archive_file.delete_password_zip.output_base64sha256
  
  function_name = "${var.project_name}-delete-password-${var.environment}"
  role          = var.delete_lambda_role_arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  
  timeout     = var.timeout_seconds
  memory_size = var.memory_mb

  reserved_concurrent_executions = var.reserved_concurrency

  dynamic "dead_letter_config" {
    for_each = lookup(var.dlq_arns, "delete", null) != null ? [1] : []
    content {
      target_arn = var.dlq_arns["delete"]
    }
  }
  
  logging_config {
    log_group  = var.delete_log_group_name
    log_format = "JSON"
  }
  
  environment {
    variables = {
      PASSWORD_TABLE  = var.dynamodb_table_name
      ALLOWED_ORIGIN  = var.frontend_origin
      AUDIT_LOG_BUCKET = var.s3_audit_logs_bucket_name
    }
  }

  tags = {
    Name     = "${var.project_name}-delete-password"
    Function = "DeletePassword"
  }
}



