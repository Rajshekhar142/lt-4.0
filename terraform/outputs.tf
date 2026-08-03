output "instance_id" {
  value       = module.ec2.instance_id
  description = "The ID of the EC2 instance"
}

output "public_ip" {
  value       = module.ec2.public_ip
  description = "Public IP address of the instance"
}
