# IAM Module - Least-privilege roles and policies for Lambda functions
# Each Lambda function gets ONLY the permissions it needs

# ========== TRUST POLICY - Allow Lambda to assume these roles ==========
locals {
  lambda_trust_policy = {
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  }
}

# ========== 1. CREATE PASSWORD LAMBDA ROLE ==========
resource "aws_iam_role" "create_password_role" {
  name               = "${var.project_name}-create-password-role-${var.environment}"
  assume_role_policy = jsonencode(local.lambda_trust_policy)
}

# Policy: Allow PutItem only for CREATE lambda
resource "aws_iam_role_policy" "create_password_policy" {
  name = "${var.project_name}-create-password-policy"
  role = aws_iam_role.create_password_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBPutItem"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem"
        ]
        Resource = var.dynamodb_table_arn
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/lambda/*"
      },
      {
        Sid    = "WriteAuditLogs"
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "${var.s3_audit_logs_bucket_arn}/audit-logs/*"
      }
    ]
  })
}

# ========== 2. READ PASSWORDS LAMBDA ROLE ==========
resource "aws_iam_role" "read_passwords_role" {
  name               = "${var.project_name}-read-passwords-role-${var.environment}"
  assume_role_policy = jsonencode(local.lambda_trust_policy)
}

# Policy: Allow Query and Scan (read-only) for READ lambda
resource "aws_iam_role_policy" "read_passwords_policy" {
  name = "${var.project_name}-read-passwords-policy"
  role = aws_iam_role.read_passwords_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBQuery"
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:GetItem"
        ]
        Resource = var.dynamodb_table_arn
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/lambda/*"
      },
      {
        Sid    = "WriteAuditLogs"
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "${var.s3_audit_logs_bucket_arn}/audit-logs/*"
      }
    ]
  })
}

# ========== 3. UPDATE PASSWORD LAMBDA ROLE ==========
resource "aws_iam_role" "update_password_role" {
  name               = "${var.project_name}-update-password-role-${var.environment}"
  assume_role_policy = jsonencode(local.lambda_trust_policy)
}

# Policy: Allow UpdateItem and GetItem (to verify before update) for UPDATE lambda
resource "aws_iam_role_policy" "update_password_policy" {
  name = "${var.project_name}-update-password-policy"
  role = aws_iam_role.update_password_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBUpdateItem"
        Effect = "Allow"
        Action = [
          "dynamodb:UpdateItem",
          "dynamodb:GetItem"
        ]
        Resource = var.dynamodb_table_arn
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/lambda/*"
      },
      {
        Sid    = "WriteAuditLogs"
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "${var.s3_audit_logs_bucket_arn}/audit-logs/*"
      }
    ]
  })
}

# ========== 4. DELETE PASSWORD LAMBDA ROLE ==========
resource "aws_iam_role" "delete_password_role" {
  name               = "${var.project_name}-delete-password-role-${var.environment}"
  assume_role_policy = jsonencode(local.lambda_trust_policy)
}

# Policy: Allow DeleteItem and GetItem (to verify before deleting) for DELETE lambda
resource "aws_iam_role_policy" "delete_password_policy" {
  name = "${var.project_name}-delete-password-policy"
  role = aws_iam_role.delete_password_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBDeleteItem"
        Effect = "Allow"
        Action = [
          "dynamodb:DeleteItem",
          "dynamodb:GetItem"
        ]
        Resource = var.dynamodb_table_arn
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/lambda/*"
      },
      {
        Sid    = "WriteAuditLogs"
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "${var.s3_audit_logs_bucket_arn}/audit-logs/*"
      }
    ]
  })
}

# Optional: CloudWatch permission for X-Ray (if you want distributed tracing)
# Uncomment to enable X-Ray tracing
# resource "aws_iam_role_policy_attachment" "lambda_xray_write" {
#   role       = aws_iam_role.create_password_role.name
#   policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
# }
