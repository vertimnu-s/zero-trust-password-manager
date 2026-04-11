# IAM Module - Least-privilege roles and policies for Lambda functions

# ========== TRUST POLICY ==========
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
          "dynamodb:GetItem",
          "dynamodb:DeleteItem",
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

# ========== 4. DELETE PASSWORD LAMBDA ROLE ==========
resource "aws_iam_role" "delete_password_role" {
  name               = "${var.project_name}-delete-password-role-${var.environment}"
  assume_role_policy = jsonencode(local.lambda_trust_policy)
}

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

# ========== AWS MANAGED POLICIES FOR LAMBDA BASIC EXECUTION ==========

resource "aws_iam_role_policy_attachment" "create_lambda_basic_execution" {
  role       = aws_iam_role.create_password_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "read_lambda_basic_execution" {
  role       = aws_iam_role.read_passwords_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "update_lambda_basic_execution" {
  role       = aws_iam_role.update_password_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "delete_lambda_basic_execution" {
  role       = aws_iam_role.delete_password_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

locals {
  kms_enabled = length(var.kms_key_arns) > 0
  all_lambda_roles = [
    aws_iam_role.create_password_role.name,
    aws_iam_role.read_passwords_role.name,
    aws_iam_role.update_password_role.name,
    aws_iam_role.delete_password_role.name,
  ]
}

resource "aws_iam_role_policy" "kms_access" {
  count = local.kms_enabled ? length(local.all_lambda_roles) : 0

  name = "${var.project_name}-kms-access"
  role = local.all_lambda_roles[count.index]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "KMSAccess"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:GenerateDataKey",
          "kms:GenerateDataKey*"
        ]
        Resource = var.kms_key_arns
      }
    ]
  })
}

resource "aws_iam_role_policy" "dlq_send" {
  for_each = var.dlq_arns

  name = "${var.project_name}-dlq-send-${each.key}"
  role = local.all_lambda_roles[index(["create", "read", "update", "delete"], each.key)]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "SQSSendMessage"
        Effect   = "Allow"
        Action   = "sqs:SendMessage"
        Resource = each.value
      }
    ]
  })
}
