data "aws_caller_identity" "current" {
  count = var.enabled ? 1 : 0
}

data "aws_region" "current" {
  count = var.enabled ? 1 : 0
}

resource "aws_kms_key" "dynamodb" {
  count = var.enabled ? 1 : 0

  description             = "CMK for DynamoDB password vault encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  rotation_period_in_days = 365

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "RootAccess"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current[0].account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-dynamodb-cmk-${var.environment}"
  }
}

resource "aws_kms_alias" "dynamodb" {
  count = var.enabled ? 1 : 0

  name          = "alias/${var.project_name}-dynamodb-${var.environment}"
  target_key_id = aws_kms_key.dynamodb[0].key_id
}

resource "aws_kms_key" "s3" {
  count = var.enabled ? 1 : 0

  description             = "CMK for S3 audit logs encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  rotation_period_in_days = 365

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "RootAccess"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current[0].account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "CloudTrailAccess"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource  = "*"
        Condition = {
          StringLike = {
            "kms:EncryptionContext:aws:cloudtrail:arn" = "arn:aws:cloudtrail:${data.aws_region.current[0].name}:${data.aws_caller_identity.current[0].account_id}:trail/*"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-s3-cmk-${var.environment}"
  }
}

resource "aws_kms_alias" "s3" {
  count = var.enabled ? 1 : 0

  name          = "alias/${var.project_name}-s3-${var.environment}"
  target_key_id = aws_kms_key.s3[0].key_id
}
