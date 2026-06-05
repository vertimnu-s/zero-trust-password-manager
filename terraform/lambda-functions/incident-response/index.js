import { WAFV2Client, GetIPSetCommand, UpdateIPSetCommand } from "@aws-sdk/client-wafv2";
import {
  CognitoIdentityProviderClient,
  AdminDisableUserCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const waf = new WAFV2Client({ region: "us-east-1" });
const cognito = new CognitoIdentityProviderClient({});
const sns = new SNSClient({});

const WAF_IP_SET_ID = process.env.WAF_IP_SET_ID;
const WAF_IP_SET_NAME = process.env.WAF_IP_SET_NAME;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

async function notifyAdmin(subject, message) {
  if (!SNS_TOPIC_ARN) return;
  try {
    await sns.send(
      new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: subject.substring(0, 100),
        Message: message,
      })
    );
  } catch (err) {
    console.error("Failed to send SNS notification:", err);
  }
}

async function blockIP(ip) {
  if (!WAF_IP_SET_ID || !WAF_IP_SET_NAME) {
    console.warn("WAF IP set not configured, skipping IP block");
    return false;
  }

  try {
    const cidr = ip.includes("/") ? ip : `${ip}/32`;

    const current = await waf.send(
      new GetIPSetCommand({
        Id: WAF_IP_SET_ID,
        Name: WAF_IP_SET_NAME,
        Scope: "CLOUDFRONT",
      })
    );

    const existing = current.IPSet.Addresses || [];
    if (existing.includes(cidr)) {
      console.log(`IP ${cidr} already blocked`);
      return true;
    }

    await waf.send(
      new UpdateIPSetCommand({
        Id: WAF_IP_SET_ID,
        Name: WAF_IP_SET_NAME,
        Scope: "CLOUDFRONT",
        LockToken: current.LockToken,
        Addresses: [...existing, cidr],
      })
    );

    console.log(`Blocked IP: ${cidr}`);
    await notifyAdmin(
      `[Remediation] IP Blocked: ${cidr}`,
      `Automated incident response blocked IP address ${cidr} via WAF IP set.\n\nThis was triggered by a GuardDuty finding. Review the finding in the AWS console for details.`
    );
    return true;
  } catch (err) {
    console.error("Failed to block IP:", err);
    return false;
  }
}

async function disableCompromisedUser(principalId) {
  if (!COGNITO_USER_POOL_ID || !principalId) {
    console.warn("Cognito not configured or no principal ID, skipping user disable");
    return false;
  }

  try {
    const users = await cognito.send(
      new ListUsersCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Filter: `sub = "${principalId}"`,
        Limit: 1,
      })
    );

    if (!users.Users || users.Users.length === 0) {
      console.log(`No Cognito user found for sub ${principalId}`);
      return false;
    }

    const username = users.Users[0].Username;
    await cognito.send(
      new AdminDisableUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: username,
      })
    );

    console.log(`Disabled user: ${username}`);
    await notifyAdmin(
      `[Remediation] User Disabled: ${username}`,
      `Automated incident response disabled Cognito user "${username}" (sub: ${principalId}).\n\nThis was triggered by a GuardDuty finding indicating potential account compromise. Review the finding and re-enable the user manually if this was a false positive.`
    );
    return true;
  } catch (err) {
    console.error("Failed to disable user:", err);
    return false;
  }
}

export const handler = async (event) => {
  console.log("Incident response triggered:", JSON.stringify(event));

  const detail = event.detail || {};
  const findingType = detail.type || "";
  const severity = detail.severity || 0;
  const title = detail.title || "Unknown finding";

  const actions = [];

  const remoteIp =
    detail.service?.action?.networkConnectionAction?.remoteIpDetails?.ipAddressV4 ||
    detail.service?.action?.awsApiCallAction?.remoteIpDetails?.ipAddressV4 ||
    detail.service?.action?.portProbeAction?.portProbeDetails?.[0]?.remoteIpDetails?.ipAddressV4;

  const principalId =
    detail.resource?.accessKeyDetails?.principalId ||
    detail.resource?.instanceDetails?.iamInstanceProfile?.id;

  if (severity >= 4 && remoteIp) {
    const blocked = await blockIP(remoteIp);
    actions.push(`IP block ${remoteIp}: ${blocked ? "success" : "failed"}`);
  }

  if (severity >= 7) {
    const credentialFindings = [
      "UnauthorizedAccess",
      "CredentialAccess",
      "InitialAccess",
      "Persistence",
    ];
    const isCredentialFinding = credentialFindings.some((f) =>
      findingType.includes(f)
    );

    if (isCredentialFinding && principalId) {
      const disabled = await disableCompromisedUser(principalId);
      actions.push(`User disable ${principalId}: ${disabled ? "success" : "failed"}`);
    }

    if (actions.length === 0) {
      await notifyAdmin(
        `[Alert] HIGH Severity Finding: ${title}`,
        `A HIGH severity GuardDuty finding requires manual review.\n\nType: ${findingType}\nSeverity: ${severity}\nTitle: ${title}\n\nNo automated remediation was possible. Please review in the AWS console.`
      );
      actions.push("admin notification sent");
    }
  }

  const result = {
    finding: findingType,
    severity,
    actions,
    timestamp: new Date().toISOString(),
  };

  console.log("Remediation result:", JSON.stringify(result));
  return result;
};
