locals {
  bucket_name = "${var.project_name}-audit-logs-${data.aws_caller_identity.current.account_id}-${var.environment}"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "audit_logs" {
  bucket = local.bucket_name

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name              = "${var.project_name}-audit-logs"
    DataClassification = "Sensitive"
    Purpose           = "Audit and compliance"
  }
}

resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_arn != null ? "aws:kms" : "AES256"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = var.kms_key_arn != null ? true : false
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    id     = "delete-old-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = var.audit_logs_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }

  rule {
    id     = "archive-to-glacier"
    status = var.archive_to_glacier_days < var.audit_logs_retention_days ? "Enabled" : "Disabled"

    filter {}

    transition {
      days          = var.archive_to_glacier_days
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_logging" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  target_bucket = aws_s3_bucket.audit_logs.id
  target_prefix = "bucket-access-logs/"
}

resource "aws_s3_bucket_policy" "audit_logs" {
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
      },
      {
        Sid    = "AllowLambdaWriteAuditLogs"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.audit_logs.arn}/audit-logs/*"
      },
      {
        Sid       = "DenyAuditLogDeletion"
        Effect    = "Deny"
        Principal = "*"
        Action = [
          "s3:DeleteObject",
          "s3:DeleteObjectVersion"
        ]
        Resource = "${aws_s3_bucket.audit_logs.arn}/audit-logs/*"
        Condition = {
          StringNotEquals = {
            "aws:PrincipalAccount" = ""
          }
        }
      }
    ]
  })
}
