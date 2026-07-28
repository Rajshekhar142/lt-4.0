output "instance_id" {
  value       = module.ec2_instance.id
  description = "The ID of the provisioned EC2 instance"
}

output "public_ip" {
  value       = module.ec2_instance.public_ip
  description = "The public IP assigned to the instance"
}
