# This role is what lets AWS's SSM Agent (running on the box) receive
# commands at all, and lets the box itself pull the artifact from S3.
# It is separate from the GitHub deploy role above - that one lets
# GitHub Actions TRIGGER a command; this one lets the INSTANCE execute it.

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2_instance" {
  name               = "lifetracker-ec2-instance-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

# AWS-managed policy that lets SSM Agent register and receive commands
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2_instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "ec2_s3_read" {
  statement {
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${var.artifact_bucket_name}/*"]
  }
}

resource "aws_iam_policy" "ec2_s3_read" {
  name   = "lifetracker-ec2-artifact-read"
  policy = data.aws_iam_policy_document.ec2_s3_read.json
}

resource "aws_iam_role_policy_attachment" "ec2_s3_read" {
  role       = aws_iam_role.ec2_instance.name
  policy_arn = aws_iam_policy.ec2_s3_read.arn
}

resource "aws_iam_instance_profile" "ec2_instance" {
  name = "lifetracker-ec2-instance-profile"
  role = aws_iam_role.ec2_instance.name
}

# NOTE: since your EC2 instance already exists, Terraform can't retroactively
# attach this instance profile unless the instance is imported or managed here.
# Easiest path: attach it manually once via
#   aws ec2 associate-iam-instance-profile --instance-id <id> \
#     --iam-instance-profile Name=lifetracker-ec2-instance-profile
# or via the console: EC2 -> Instance -> Actions -> Security -> Modify IAM role.
