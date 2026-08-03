# --- Trust anchor: tells AWS to accept signed tokens from GitHub's OIDC issuer ---
# Only create this once per AWS account - if you already have a GitHub OIDC
# provider registered for another repo, reference it via data source instead
# of creating a duplicate (AWS will error on a second provider for the same URL).
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]

  # GitHub's OIDC signing certificate thumbprint. AWS validates the token
  # signature chain automatically for this well-known provider; this value
  # is required by the resource but not the primary security boundary -
  # the trust policy's `sub` condition below is what actually matters.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea"]
}

# --- The actual trust boundary: WHICH repo+branch may assume this role ---
data "aws_iam_policy_document" "github_deploy_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # This is the fork-PR boundary we discussed: refs/pull/N/merge will
    # never match this exact string, so a fork PR run cannot assume this role.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo_owner}/${var.github_repo_name}:ref:refs/heads/${var.github_branch}"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "lifetracker-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_deploy_trust.json

  # Short session - even a hijacked-mid-flight token can't be reused for long.
  max_session_duration = 3600
}

# --- Least-privilege permissions: only what the deploy job actually needs ---
data "aws_iam_policy_document" "github_deploy_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["arn:aws:s3:::${var.artifact_bucket_name}/*"]
  }

  statement {
    effect    = "Allow"
    actions   = ["ssm:SendCommand"]
    resources = [
      var.ec2_instance_arn,
      "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript",
    ]
  }

  # Needed to poll command status/output if you add that step later
  statement {
    effect    = "Allow"
    actions   = ["ssm:GetCommandInvocation"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "github_deploy_permissions" {
  name   = "lifetracker-deploy-permissions"
  policy = data.aws_iam_policy_document.github_deploy_permissions.json
}

resource "aws_iam_role_policy_attachment" "github_deploy" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = aws_iam_policy.github_deploy_permissions.arn
}
