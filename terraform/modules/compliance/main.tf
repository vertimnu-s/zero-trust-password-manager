data "aws_caller_identity" "current" {
  count = var.enabled ? 1 : 0
}

data "aws_region" "current" {
  count = var.enabled ? 1 : 0
}

resource "aws_iam_role" "config" {
  count = var.enabled ? 1 : 0

  name = "${var.project_name}-config-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "config.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Name = "${var.project_name}-config-role-${var.environment}"
  }
}

resource "aws_iam_role_policy" "config_s3" {
  count = var.enabled ? 1 : 0

  name = "${var.project_name}-config-s3-delivery"
  role = aws_iam_role.config[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "S3PutConfig"
        Effect   = "Allow"
        Action   = "s3:PutObject"
        Resource = "${var.audit_logs_bucket_arn}/config/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
      {
        Sid      = "S3GetBucketAcl"
        Effect   = "Allow"
        Action   = "s3:GetBucketAcl"
        Resource = var.audit_logs_bucket_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "config_managed" {
  count = var.enabled ? 1 : 0

  role       = aws_iam_role.config[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWS_ConfigRole"
}

resource "aws_config_configuration_recorder" "main" {
  count = var.enabled ? 1 : 0

  name     = "${var.project_name}-recorder-${var.environment}"
  role_arn = aws_iam_role.config[0].arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }

  recording_mode {
    recording_frequency = "DAILY"
  }
}

resource "aws_config_delivery_channel" "main" {
  count = var.enabled ? 1 : 0

  name           = "${var.project_name}-delivery-${var.environment}"
  s3_bucket_name = var.audit_logs_bucket_name
  s3_key_prefix  = "config"

  snapshot_delivery_properties {
    delivery_frequency = "TwentyFour_Hours"
  }

  depends_on = [aws_config_configuration_recorder.main]
}

resource "aws_config_configuration_recorder_status" "main" {
  count = var.enabled ? 1 : 0

  name       = aws_config_configuration_recorder.main[0].name
  is_enabled = true

  depends_on = [aws_config_delivery_channel.main]
}

resource "aws_securityhub_account" "main" {
  count = var.enabled ? 1 : 0

  auto_enable_controls = true

  depends_on = [aws_config_configuration_recorder_status.main]
}

resource "aws_securityhub_standards_subscription" "cis" {
  count = var.enabled ? 1 : 0

  standards_arn = "arn:aws:securityhub:${data.aws_region.current[0].name}::standards/cis-aws-foundations-benchmark/v/1.4.0"

  depends_on = [aws_securityhub_account.main]
}

resource "aws_securityhub_standards_subscription" "aws_best_practices" {
  count = var.enabled ? 1 : 0

  standards_arn = "arn:aws:securityhub:${data.aws_region.current[0].name}::standards/aws-foundational-security-best-practices/v/1.0.0"

  depends_on = [aws_securityhub_account.main]
}

resource "aws_securityhub_product_subscription" "guardduty" {
  count = var.enabled && var.guardduty_enabled ? 1 : 0

  product_arn = "arn:aws:securityhub:${data.aws_region.current[0].name}::product/aws/guardduty"

  depends_on = [aws_securityhub_account.main]
}
