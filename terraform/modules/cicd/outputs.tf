output "github_deploy_role_arn" {
  description = "Paste this into IAM_ROLE_ARN in deploy.yml"
  value       = aws_iam_role.github_deploy.arn
}

output "artifact_bucket_name" {
  value = aws_s3_bucket.artifacts.bucket
}

output "ec2_instance_profile_name" {
  description = "Attach this to your existing EC2 instance (see note in ec2-instance-role.tf)"
  value       = aws_iam_instance_profile.ec2_instance.name
}
