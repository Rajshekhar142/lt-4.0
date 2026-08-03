output "instance_id" {
  value       = module.ec2.instance_id
  description = "The ID of the EC2 instance"
}

output "public_ip" {
  value       = module.ec2.public_ip
  description = "Public IP address of the instance"
}
output "github_deploy_role_arn" {
  value = module.cicd.github_deploy_role_arn
}

output "artifact_bucket_name" {
  value = module.cicd.artifact_bucket_name
}

output "ec2_instance_profile_name" {
  value = module.cicd.ec2_instance_profile_name
}