Write-Host "Git sha: $env:GITHUB_SHA"
Write-Host "$(Get-Location)"
Write-Host "$(Get-ChildItem .)"
$files = git diff-tree --no-commit-id --name-only -r $env:GITHUB_SHA
Write-Host "Git files: $files"
$eslintFiles = [string]::join(" ", $files.Split('\n'))
Write-Host "ESLint check files: $eslintFiles"
if ($eslintFiles.Length -eq 0) {
    Write-Host "Skip ESLint since no input files."
} else {
    npx eslint -c ./.eslintrc.yaml $eslintFiles
}