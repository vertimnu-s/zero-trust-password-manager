# S3 Module - Audit Logs and Backup Storage

# Generate a unique bucket name (S3 bucket names must be globally unique)
locals {
  bucket_name = "${var.project_name}-audit-logs-${data.aws_caller_identity.current.account_id}-${var.environment}"
}

data "aws_caller_identity" "current" {}

# S3 Bucket for audit logs
resource "aws_s3_bucket" "audit_logs" {
  bucket = local.bucket_name

  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name              = "${var.project_name}-audit-logs"
    DataClassification = "Sensitive"
    Purpose           = "Audit and compliance"
  }
}

# Enable versioning for version history
resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

# Block public access (CRITICAL - audit logs should NEVER be public)
resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable encryption at rest using AWS managed keys
resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"  # AWS managed keys
    }
  }
}

# Enable default encryption for all objects
resource "aws_s3_bucket_server_side_encryption_configuration" "ensure_encryption" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# LIFECYCLE POLICY - Manage cost by archiving old logs
resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    id     = "archive-old-logs"
    status = "Enabled"

    # Move to Glacier after 30 days (reduces cost from $0.023 to $0.0036 per GB/month)
    transitions {
      days          = var.archive_to_glacier_days
      storage_class = "GLACIER"
    }

    # Delete after 90 days (optional - change if you need longer retention)
    expiration {
      days = var.audit_logs_retention_days
    }

    # Delete old versions after 30 days
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# Enable logging for the bucket itself (meta-log)
resource "aws_s3_bucket_logging" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  target_bucket = aws_s3_bucket.audit_logs.id
  target_prefix = "bucket-access-logs/"
}

# CloudWatch Logs integration (optional - for Lambda audit logs to flow to S3)
resource "aws_s3_bucket_policy" "allow_cloudwatch_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchLogsToS3"
        Effect = "Allow"
        Principal = {
          Service = "logs.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.audit_logs.arn}/*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowCloudWatchLogsGetBucketVersioning"
        Effect = "Allow"
        Principal = {
          Service = "logs.amazonaws.com"
        }
        Action   = "s3:GetBucketVersioning"
        Resource = aws_s3_bucket.audit_logs.arn
      }
    ]
  })
}

# Allow Lambda to write audit logs
resource "aws_s3_bucket_policy" "allow_lambda_audit" {
  bucket = aws_s3_bucket.audit_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaWriteAuditLogs"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.audit_logs.arn}/audit-logs/*"
      }
    ]
  })
}

# Optional: Enable replication for disaster recovery (advanced)
# Uncomment if you want backup to another region
# resource "aws_s3_bucket_replication_configuration" "audit_logs" {
#   bucket = aws_s3_bucket.audit_logs.id
#   role   = aws_iam_role.s3_replication_role.arn
#   ...
# }
