output "public_ip" {
  description = "EC2の固定IP（Elastic IP）"
  value       = aws_eip.app.public_ip
}

output "site_address" {
  description = "アプリのアドレス（sslip.io。Caddy の SITE_ADDRESS に渡す）"
  value       = "${replace(aws_eip.app.public_ip, ".", "-")}.sslip.io"
}

output "ssh_command" {
  description = "SSH接続のコマンド（リポジトリ直下で実行）"
  value       = "ssh -i infra/reading-app-key ec2-user@${aws_eip.app.public_ip}"
}
