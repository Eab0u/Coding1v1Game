# Windows PowerShell version of loop.sh
# Run from the project root (a git repo) containing GOAL.md.
# Stop it by creating a file named STOP in this folder:  New-Item STOP -ItemType File

# Change this to "--full-auto" to keep the sandbox on (then enable network_access in ~/.codex/config.toml)
$CodexFlag = "--yolo"

$prompt = "Read GOAL.md and PROGRESS.md. Pick the single most valuable unchecked backlog item. If the backlog is empty, follow the Endless improvement mode section in GOAL.md and add new items, including making the site look and feel better. Implement the item fully, write or update tests, run the tests, fix any failures, check the item off in GOAL.md, update PROGRESS.md, then stop. Never declare the project finished."

New-Item -ItemType Directory -Force -Path logs | Out-Null
if (-not (Test-Path PROGRESS.md)) { New-Item PROGRESS.md -ItemType File | Out-Null }

git checkout -b overnight 2>$null
if ($LASTEXITCODE -ne 0) { git checkout overnight }

$i = 0
while ($true) {
    if (Test-Path STOP) {
        Write-Host "STOP file found, exiting."
        break
    }

    $i++
    Write-Host "=== Iteration $i started $(Get-Date) ==="

    codex exec $CodexFlag $prompt -o "logs\run_$i.txt"
    $status = $LASTEXITCODE

    if ($status -ne 0) {
        # likely a usage or rate limit: wait an hour, then retry
        Add-Content logs\errors.txt "codex failed at iteration $i (exit $status) at $(Get-Date), sleeping 1 hour"
        Write-Host "Codex failed (exit $status). Sleeping 1 hour, then retrying."
        Start-Sleep -Seconds 3600
        continue
    }

    # before the scaffold exists there is no package.json, so keep the work
    $testsOk = $true
    if (Test-Path package.json) {
        npm test
        $testsOk = ($LASTEXITCODE -eq 0)
    }

    if ($testsOk) {
        git add -A
        git commit -m "auto: iteration $i"
    } else {
        Add-Content logs\errors.txt "tests failed at iteration $i at $(Get-Date), discarding"
        git reset --hard
        git clean -fd
    }

    Start-Sleep -Seconds 30
}
