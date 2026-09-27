# デフォルトVPC・デフォルトサブネットを使う（VPCやNATゲートウェイを新しく作ると費用がかかるため）
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Amazon Linux 2023 の最新AMI（インスタンスタイプのCPUに合わせる。t4g は arm64）
data "aws_ec2_instance_type" "selected" {
  instance_type = var.instance_type
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023*-kernel-6.1-${data.aws_ec2_instance_type.selected.supported_architectures[0]}"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_key_pair" "app" {
  key_name   = "${var.project_name}-key"
  public_key = file(var.ssh_public_key_path)
}

resource "aws_security_group" "app" {
  name        = "${var.project_name}-sg"
  description = "SSH and HTTPS from my IP only. HTTP from anywhere for Lets Encrypt and redirect to HTTPS"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH (my IP only)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip_cidr]
  }

  ingress {
    description = "HTTPS app (my IP only)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.my_ip_cidr]
  }

  # Let's Encrypt の検証サーバーのIPは公開されていないため、80番は全体に開ける。
  # Caddy は80番では証明書の検証への応答と HTTPS への転送しか返さない（アプリ本体は443番だけ）
  ingress {
    description = "HTTP for Lets Encrypt and redirect to HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg"
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.app.key_name
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.app.id]

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
    encrypted   = true
  }

  # インスタンスメタデータは IMDSv2（トークン必須）のみにする
  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  user_data = templatefile("${path.module}/user_data.sh", {
    compose_arch = data.aws_ec2_instance_type.selected.supported_architectures[0] == "arm64" ? "aarch64" : "x86_64"
  })

  tags = {
    Name = "${var.project_name}-app"
  }

  lifecycle {
    # AMIの更新（新しいAL2023の公開）で勝手にインスタンスが作り直されないようにする。
    # 作り直すとDBのボリュームも消えるため、更新したいときは意図して replace する
    ignore_changes = [ami, user_data]
  }
}

# sslip.io のホスト名はIPから決まるので、インスタンスを止めてもIPが変わらないよう固定する
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-eip"
  }
}
