data "aws_caller_identity" "current" {
  count = var.enabled ? 1 : 0
}

resource "aws_s3_bucket" "trail_logs" {
  count = var.enabled ? 1 : 0

  bucket        = "${var.project_name}-cloudtrail-${var.environment}-${data.aws_caller_identity.current[0].account_id}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-cloudtrail-logs-${var.environment}"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "trail_logs" {
  count  = var.enabled ? 1 : 0
  bucket = aws_s3_bucket.trail_logs[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "trail_logs" {
  count  = var.enabled ? 1 : 0
  bucket = aws_s3_bucket.trail_logs[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "trail_logs" {
  count  = var.enabled ? 1 : 0
  bucket = aws_s3_bucket.trail_logs[0].id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = var.s3_log_retention_days
    }
  }
}

resource "aws_s3_bucket_policy" "trail_logs" {
  count  = var.enabled ? 1 : 0
  bucket = aws_s3_bucket.trail_logs[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AWSCloudTrailAclCheck"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.trail_logs[0].arn
      },
      {
        Sid       = "AWSCloudTrailWrite"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.trail_logs[0].arn}/AWSLogs/${data.aws_caller_identity.current[0].account_id}/*"
        Condition = {
          StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" }
        }
      }
    ]
  })
}

resource "aws_cloudtrail" "main" {
  count = var.enabled ? 1 : 0

  name                       = "${var.project_name}-trail-${var.environment}"
  s3_bucket_name             = aws_s3_bucket.trail_logs[0].id
  include_global_service_events = true
  is_multi_region_trail      = true
  enable_log_file_validation = true

  event_selector {
    read_write_type           = "All"
    include_management_events = true
  }

  tags = {
    Name = "${var.project_name}-trail-${var.environment}"
  }

  depends_on = [aws_s3_bucket_policy.trail_logs]
}
