# Agentic Automation — Instalador
# Execute com botao direito > "Executar com PowerShell"

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   Agentic Automation — Instalador              " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Destino da extensao
$dest = "$env:LOCALAPPDATA\AgenticAutomation"

# Copia os arquivos da extensao para AppData (pasta permanente)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$extSrc = $scriptDir

# Verifica se o manifest.json existe no diretório (garante que é a pasta da extensão)
if (-not (Test-Path (Join-Path $extSrc "manifest.json"))) {
    Write-Host "[ERRO] Arquivo 'manifest.json' nao encontrado no diretorio do script." -ForegroundColor Red
    Write-Host "Certifique-se de que este script esta na raiz da extensao." -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "Copiando arquivos para: $dest" -ForegroundColor White
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dest > $null
Get-ChildItem -Path $extSrc | Where-Object { $_.Name -notmatch '^node_modules$|^\.git$|^\.vscode$|^tests$|^package\.json$|^package-lock\.json$|^vitest\.config\.js$' } | ForEach-Object {
    Copy-Item $_.FullName -Destination $dest -Recurse
}

Write-Host "[OK] Arquivos copiados." -ForegroundColor Green
Write-Host ""
Write-Host "Abrindo o Chrome na pagina de extensoes..." -ForegroundColor White

# Abre o Chrome
$chromePaths = @(
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
    "${env:PROGRAMFILES(X86)}\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome) {
    & $chrome "chrome://extensions"
} else {
    Write-Host "[AVISO] Chrome nao encontrado. Abra o Chrome manualmente." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " PASSOS PARA CONCLUIR A INSTALACAO:" -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " 1. No Chrome, ative o 'Modo do desenvolvedor'" -ForegroundColor White
Write-Host "    (botao no canto superior direito da pagina)" -ForegroundColor Gray
Write-Host ""
Write-Host " 2. Clique em 'Carregar sem compactacao'" -ForegroundColor White
Write-Host "    (ou 'Load unpacked')" -ForegroundColor Gray
Write-Host ""
Write-Host " 3. Selecione a pasta:" -ForegroundColor White
Write-Host "    $dest" -ForegroundColor Cyan
Write-Host ""
Write-Host " 4. Clique no icone da extensao na barra do Chrome" -ForegroundColor White
Write-Host "    e depois em 'Abrir painel lateral'" -ForegroundColor Gray
Write-Host ""
Write-Host " 5. Acesse as Configuracoes da extensao e insira" -ForegroundColor White
Write-Host "    sua chave de API (DeepSeek, OpenAI ou local)." -ForegroundColor Gray
Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " Pronto! Divirta-se com o Agentic Automation :)" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Coloca o caminho na area de transferencia para facilitar
$dest | Set-Clipboard
Write-Host "(O caminho da pasta foi copiado para a area de transferencia)" -ForegroundColor Gray
Write-Host ""
Read-Host "Pressione Enter para sair"
