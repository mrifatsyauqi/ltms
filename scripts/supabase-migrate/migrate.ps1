param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("audit", "backup", "migrate", "verify")]
    [string]$Command
)

# Load environment variables if config.env exists
$envFile = Join-Path $PSScriptRoot "config.env"
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match '^[^#]' -and $_ -match '=' } | ForEach-Object {
        $name, $value = $_.Split('=', 2)
        [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim())
    }
}

$previewDbUrl = [System.Environment]::GetEnvironmentVariable("SUPABASE_PREVIEW_DB_URL")
$prodDbUrl = [System.Environment]::GetEnvironmentVariable("SUPABASE_PRODUCTION_DB_URL")

if ([string]::IsNullOrWhiteSpace($previewDbUrl) -or [string]::IsNullOrWhiteSpace($prodDbUrl)) {
    Write-Host "ERROR: SUPABASE_PREVIEW_DB_URL or SUPABASE_PRODUCTION_DB_URL is missing." -ForegroundColor Red
    Write-Host "Please create config.env based on config.example.env" -ForegroundColor Yellow
    exit 1
}

function Invoke-Psql {
    param ($DbUrl, $SqlFile)
    
    # We use npx supabase to execute the query safely instead of requiring local psql
    Write-Host "Executing $SqlFile ..."
    # Because db_url is required, we use postgresql native client if available, or npx supabase
    # But npx supabase doesn't have a direct "execute sql file against remote url" easily if not linked.
    # Actually, we can use "psql" if installed. Let's check for psql.
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if ($psql) {
        & psql $DbUrl -f $SqlFile
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR executing SQL" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "psql is not installed or not in PATH. Please install PostgreSQL client tools to execute SQL scripts." -ForegroundColor Red
        exit 1
    }
}

function Invoke-Dump {
    param ($DbUrl, $OutputFile)
    $pgdump = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($pgdump) {
        & pg_dump $DbUrl --schema-only -f $OutputFile
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Backup failed!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "pg_dump is not installed or not in PATH." -ForegroundColor Red
        exit 1
    }
}

switch ($Command) {
    "audit" {
        Write-Host "=========================================="
        Write-Host "PHASE 2 - AUDIT: PUSH MAS KURIR DEPENDENCIES"
        Write-Host "=========================================="
        Write-Host "Tabel yang akan dimigrasikan:"
        Write-Host "- whatsapp_contacts"
        Write-Host "- whatsapp_sender_connections"
        Write-Host "- whatsapp_message_templates"
        Write-Host "- whatsapp_send_batches"
        Write-Host "- whatsapp_send_logs"
        Write-Host "- whatsapp_configurations"
        Write-Host ""
        Write-Host "Data yang TIDAK dimigrasikan:"
        Write-Host "- Transaction history (whatsapp_send_batches dan whatsapp_send_logs dari Preview)"
        Write-Host "- Data testing kontak"
        Write-Host ""
        Write-Host "Perubahan schema tambahan:"
        Write-Host "- Modifikasi RLS policies"
        Write-Host "- Update menu_key pada role_permissions"
        Write-Host "- Penambahan index blast_id"
        Write-Host ""
        Write-Host "Status Git Merge:"
        Write-Host "Pending (Tunggu hingga 'verify' sukses)."
        Write-Host "=========================================="
        Write-Host "Audit Selesai. Gunakan '.\migrate.ps1 backup' untuk melanjutkan." -ForegroundColor Green
    }
    "backup" {
        Write-Host "=========================================="
        Write-Host "PHASE 5 - BACKUP PRODUCTION"
        Write-Host "=========================================="
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $backupDir = Join-Path $PSScriptRoot "backups\$timestamp"
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        
        $outFile = Join-Path $backupDir "production_schema.sql"
        Write-Host "Backing up Production schema to $outFile ..."
        Invoke-Dump -DbUrl $prodDbUrl -OutputFile $outFile
        Write-Host "Backup Successful." -ForegroundColor Green
    }
    "migrate" {
        Write-Host "=========================================="
        Write-Host "PHASE 6 - EXECUTE MIGRATION TO PRODUCTION"
        Write-Host "=========================================="
        $confirmation = Read-Host "Warning: This will modify the PRODUCTION database! Type 'MIGRATE PRODUCTION' to confirm"
        if ($confirmation -cne "MIGRATE PRODUCTION") {
            Write-Host "Confirmation failed. Aborting." -ForegroundColor Red
            exit 1
        }
        
        $sqlFile = Join-Path $PSScriptRoot "02-schema-migration.sql"
        Invoke-Psql -DbUrl $prodDbUrl -SqlFile $sqlFile
        Write-Host "Migration applied successfully." -ForegroundColor Green
    }
    "verify" {
        Write-Host "=========================================="
        Write-Host "PHASE 7 - VERIFY PRODUCTION"
        Write-Host "=========================================="
        $sqlFile = Join-Path $PSScriptRoot "03-verify-production.sql"
        Invoke-Psql -DbUrl $prodDbUrl -SqlFile $sqlFile
    }
}
