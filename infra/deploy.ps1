<#
.SYNOPSIS
    読書管理アプリを EC2 にデプロイする。

.DESCRIPTION
    1. Terraform の出力から EC2 の IP と sslip.io のアドレスを取得する
    2. コミット済みの内容（git archive HEAD）を tar.gz にまとめる
    3. 環境変数ファイル（SITE_ADDRESS・Google Books APIキー）を作る。APIキーは .env.local から読み、画面には表示しない
    4. EC2 へ転送し、EC2 上でイメージをビルドしてコンテナを入れ替える（DB・証明書はボリュームにあるので消えない）
    5. https://<アドレス>/api/health が 200 になるまで待つ（初回は Let's Encrypt の証明書取得に少し時間がかかる）

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File infra/deploy.ps1
#>

$ErrorActionPreference = "Stop"

$InfraDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent $InfraDir
$TerraformDir = Join-Path $InfraDir "terraform"
$KeyPath = Join-Path $InfraDir "reading-app-key"

function Invoke-Checked {
    param(
        [Parameter(Mandatory)][string]$Description,
        [Parameter(Mandatory)][ScriptBlock]$Action
    )
    Write-Host "==> $Description" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
        throw "失敗: $Description (exit code $LASTEXITCODE)"
    }
}

# --- 1. Terraform の出力 ---
Push-Location $TerraformDir
try {
    $Ip = terraform output -raw public_ip
    $Site = terraform output -raw site_address
}
finally {
    Pop-Location
}
if ([string]::IsNullOrWhiteSpace($Ip) -or [string]::IsNullOrWhiteSpace($Site)) {
    throw "Terraform の出力を取得できませんでした。先に infra/terraform で terraform apply を実行してください。"
}
Write-Host "    EC2: $Ip"
Write-Host "    URL: https://$Site/"

if (-not (Test-Path $KeyPath)) {
    throw "SSH の秘密鍵が見つかりません: $KeyPath"
}

# Windows の OpenSSH は、自分以外も読める秘密鍵を拒否する（bad permissions）。鍵の権限を自分だけにする
icacls $KeyPath /inheritance:r /grant:r "${env:USERNAME}:R" | Out-Null

$Remote = "ec2-user@$Ip"
$SshOptions = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes")

# --- 2. ソースをまとめる ---
$Uncommitted = git -C $RepoRoot status --porcelain
if ($Uncommitted) {
    Write-Warning "コミットされていない変更があります。デプロイされるのはコミット済みの内容（HEAD）だけです。"
}
$Commit = git -C $RepoRoot rev-parse --short HEAD
$TarPath = Join-Path $env:TEMP "reading-app-deploy.tar.gz"
Invoke-Checked -Description "コミット $Commit を tar.gz にまとめる" -Action {
    git -C $RepoRoot archive --format=tar.gz -o $TarPath HEAD
}

# --- 3. 環境変数ファイル ---
$ApiKey = ""
$EnvLocal = Join-Path $RepoRoot ".env.local"
if (Test-Path $EnvLocal) {
    $Line = Get-Content $EnvLocal | Where-Object { $_ -match '^\s*VITE_GOOGLE_BOOKS_API_KEY\s*=' } | Select-Object -First 1
    if ($Line) {
        $ApiKey = ($Line -replace '^\s*VITE_GOOGLE_BOOKS_API_KEY\s*=\s*', '').Trim().Trim('"', "'")
    }
}
if ($ApiKey -eq "") {
    Write-Warning "Google Books APIキーが見つかりません（.env.local）。キーなしでビルドします（検索が 429 になることがあります）。"
}
$EnvPath = Join-Path $env:TEMP "reading-app.env"
$EnvText = "SITE_ADDRESS=$Site`nVITE_GOOGLE_BOOKS_API_KEY=$ApiKey`n"
[IO.File]::WriteAllText($EnvPath, $EnvText, (New-Object System.Text.UTF8Encoding $false))

# --- 4. 転送とビルド・起動 ---
try {
    Invoke-Checked -Description "EC2 へ転送" -Action {
        scp @SshOptions $TarPath $EnvPath "${Remote}:~/"
    }
}
finally {
    Remove-Item $EnvPath -Force -ErrorAction SilentlyContinue
}

# EC2 上で実行するコマンド（ソースは毎回まっさらに展開し直す。DB・証明書は Docker のボリュームにある）。
# ディスクが10GBしかないので、使われなくなったイメージと1週間より古いビルドキャッシュは消す
$RemoteScript = @(
    "set -eu",
    "chmod 600 ~/reading-app.env",
    "rm -rf ~/reading-app.new && mkdir ~/reading-app.new",
    "tar xzf ~/reading-app-deploy.tar.gz -C ~/reading-app.new",
    "rm -rf ~/reading-app && mv ~/reading-app.new ~/reading-app && rm ~/reading-app-deploy.tar.gz",
    "cd ~/reading-app",
    "docker compose --env-file ~/reading-app.env -f infra/docker/docker-compose.prod.yml up -d --build --remove-orphans",
    "docker image prune -f",
    "docker builder prune -f --filter until=168h",
    "docker compose --env-file ~/reading-app.env -f infra/docker/docker-compose.prod.yml ps"
) -join "; "
Invoke-Checked -Description "EC2 上でビルドして起動（初回は数分かかります）" -Action {
    ssh @SshOptions $Remote $RemoteScript
}

# --- 5. 疎通確認 ---
Write-Host "==> https://$Site/api/health の応答を待っています" -ForegroundColor Cyan
$Ok = $false
for ($i = 0; $i -lt 36; $i++) {
    $Status = curl.exe -s -o NUL -w "%{http_code}" --max-time 10 "https://$Site/api/health"
    if ($Status -eq "200") {
        $Ok = $true
        break
    }
    Start-Sleep -Seconds 5
}
if (-not $Ok) {
    throw "https://$Site/api/health が 200 になりませんでした（最後の応答: $Status）。ssh で入って docker compose logs web を確認してください。"
}
Write-Host "デプロイ完了: https://$Site/ （コミット $Commit）" -ForegroundColor Green
