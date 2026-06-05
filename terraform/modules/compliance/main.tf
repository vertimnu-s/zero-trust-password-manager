data "aws_caller_identity" "current" {
  count = var.enabled ? 1 : 0
}

data "aws_region" "current" {
  count = var.enabled ? 1 : 0
}

resource "aws_iam_service_linked_role" "config" {

  count            = var.enabled ? 1 : 0
  aws_service_name = "config.amazonaws.com"
}

data "aws_vpc" "default" {
  count   = var.enabled ? 1 : 0
  default = true
}

resource "aws_ssm_service_setting" "block_public_sharing" {
  count         = var.enabled ? 1 : 0
  setting_id    = "/ssm/documents/console/public-sharing-permission"
  setting_value = "Disable"
}

resource "aws_default_security_group" "default" {
  count                  = var.enabled ? 1 : 0
  vpc_id                 = data.aws_vpc.default[0].id
  ingress                = []
  egress                 = []
  revoke_rules_on_delete = true
}

resource "aws_ebs_snapshot_block_public_access" "default" {


  count = var.enabled ? 1 : 0
  state = "block-all-sharing"
}

resource "aws_config_configuration_recorder" "main" {

  count = var.enabled ? 1 : 0

  name     = "${var.project_name}-recorder-${var.environment}"
  role_arn = aws_iam_service_linked_role.config[0].arn

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

  provisioner "local-exec" {
    command = "sleep 120"
    when    = create
  }
}







resource "aws_securityhub_product_subscription" "guardduty" {
  count = var.enabled && var.guardduty_enabled ? 1 : 0

  product_arn = "arn:aws:securityhub:${data.aws_region.current[0].name}::product/aws/guardduty"

  depends_on = [aws_securityhub_account.main]
}
