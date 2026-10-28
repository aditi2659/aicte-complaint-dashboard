# setup-local-test-db.ps1
# Securely prompts for local PostgreSQL password, creates aicte_complaints_test, and sets TEST_DATABASE_URL

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $psqlPath)) {
    $psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCmd) { $psqlPath = $psqlCmd.Source }
}

# Create Secure Password Input Dialog
$form = New-Object System.Windows.Forms.Form
$form.Text = "AICTE Test Database Setup"
$form.Size = New-Object System.Drawing.Size(420, 200)
$form.StartPosition = "CenterScreen"
$form.TopMost = $true
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false

$label = New-Object System.Windows.Forms.Label
$label.Text = "Enter password for local PostgreSQL user 'postgres':"
$label.Location = New-Object System.Drawing.Point(20, 20)
$label.Size = New-Object System.Drawing.Size(360, 20)
$label.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$form.Controls.Add($label)

$textBox = New-Object System.Windows.Forms.TextBox
$textBox.Location = New-Object System.Drawing.Point(20, 50)
$textBox.Size = New-Object System.Drawing.Size(360, 25)
$textBox.PasswordChar = '*'
$textBox.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$form.Controls.Add($textBox)

$okButton = New-Object System.Windows.Forms.Button
$okButton.Text = "Confirm & Setup"
$okButton.Location = New-Object System.Drawing.Point(250, 100)
$okButton.Size = New-Object System.Drawing.Size(130, 30)
$okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.AcceptButton = $okButton
$form.Controls.Add($okButton)

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = "Cancel"
$cancelButton.Location = New-Object System.Drawing.Point(150, 100)
$cancelButton.Size = New-Object System.Drawing.Size(90, 30)
$cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.CancelButton = $cancelButton
$form.Controls.Add($cancelButton)

$password = $null

try {
    $result = $form.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK -and -not [string]::IsNullOrWhiteSpace($textBox.Text)) {
        $password = $textBox.Text
    }
} catch {
    # Form failed or running in headless/pipe mode
}

if ([string]::IsNullOrWhiteSpace($password)) {
    Write-Host "Entering password via secure terminal prompt..."
    $secPw = Read-Host "Enter password for local PostgreSQL user 'postgres'" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPw)
    $password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}

if ([string]::IsNullOrWhiteSpace($password)) {
    Write-Error "Database password cannot be empty."
    exit 1
}

# Test connectivity and verify credentials
$env:PGPASSWORD = $password
$checkConn = & $psqlPath -h localhost -p 5432 -U postgres -d postgres -t -A -c "SELECT 1;" 2>&1

if ($LASTEXITCODE -ne 0 -or $checkConn -notmatch "1") {
    Write-Error "Failed to connect to local PostgreSQL on port 5432 with user 'postgres'. Authentication error."
    exit 1
}

Write-Host "Authentication successful with local PostgreSQL server."

# Check if aicte_complaints_test database exists
$dbExists = & $psqlPath -h localhost -p 5432 -U postgres -d postgres -t -A -c "SELECT 1 FROM pg_database WHERE datname='aicte_complaints_test';" 2>&1

if ($dbExists -notmatch "1") {
    Write-Host "Creating dedicated test database 'aicte_complaints_test'..."
    & $psqlPath -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE aicte_complaints_test;"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create database 'aicte_complaints_test'."
        exit 1
    }
    Write-Host "Database 'aicte_complaints_test' created successfully."
} else {
    Write-Host "Database 'aicte_complaints_test' already exists."
}

# Encode password for URL if needed
$encodedPassword = [System.Uri]::EscapeDataString($password)
$testDbUrl = "postgresql://postgres:$($encodedPassword)@localhost:5432/aicte_complaints_test"

# Update backend/.env safely
$envFile = "backend\.env"
if (Test-Path $envFile) {
    $content = Get-Content $envFile
    $newContent = @()
    $hasTestDb = $false

    foreach ($line in $content) {
        if ($line -match "^TEST_DATABASE_URL=") {
            $newContent += "TEST_DATABASE_URL=`"$testDbUrl`""
            $hasTestDb = $true
        } else {
            $newContent += $line
        }
    }

    if (-not $hasTestDb) {
        $newContent += "TEST_DATABASE_URL=`"$testDbUrl`""
    }

    Set-Content -Path $envFile -Value $newContent -Encoding UTF8
    Write-Host "Configured TEST_DATABASE_URL in $envFile"
} else {
    Write-Error "backend/.env file not found."
    exit 1
}

# Clear sensitive variable from environment
$env:PGPASSWORD = $null

Write-Host "Local test database setup complete."
