[CmdletBinding()]
param(
    [string]$InputPptx = "output/generated/sample.pptx",
    [string]$PreviewDirectory = "preview",
    [ValidateRange(72, 600)]
    [int]$Dpi = 180
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-AbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$BasePath
    )

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $BasePath $Path))
}

function Assert-SafePreviewPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PreviewPath,
        [Parameter(Mandatory = $true)]
        [string]$AllowedPreviewPath
    )

    $previewBoundary = $AllowedPreviewPath + [System.IO.Path]::DirectorySeparatorChar
    if (-not $PreviewPath.Equals($AllowedPreviewPath, [System.StringComparison]::OrdinalIgnoreCase) -and
        -not $PreviewPath.StartsWith($previewBoundary, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Preview output must stay inside the project preview directory: $AllowedPreviewPath"
    }

    $pathsToCheck = @($AllowedPreviewPath)
    if (-not $PreviewPath.Equals($AllowedPreviewPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        $relativePath = $PreviewPath.Substring($previewBoundary.Length)
        $currentPath = $AllowedPreviewPath
        foreach ($segment in @([regex]::Split($relativePath, '[\\/]+') | Where-Object { $_.Length -gt 0 })) {
            $currentPath = Join-Path $currentPath $segment
            $pathsToCheck += $currentPath
        }
    }

    foreach ($path in $pathsToCheck) {
        if (-not (Test-Path -LiteralPath $path)) {
            continue
        }
        $item = Get-Item -LiteralPath $path -Force
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Preview output path must not contain a symbolic link, junction, or other reparse point: $path"
        }
    }
}

function Get-PresentationSlideCount {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PptxPath
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = $null
    try {
        $archive = [System.IO.Compression.ZipFile]::OpenRead($PptxPath)
        $slideCount = @(
            $archive.Entries |
                Where-Object { $_.FullName -match '(?i)^ppt/slides/slide\d+\.xml$' }
        ).Count
    }
    catch {
        throw "Unable to inspect the PPTX package: $($_.Exception.Message)"
    }
    finally {
        if ($null -ne $archive) {
            $archive.Dispose()
        }
    }

    if ($slideCount -le 0) {
        throw "The PPTX package does not contain any slide XML files: $PptxPath"
    }
    return $slideCount
}

function Test-PngSignature {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $expected = [byte[]](0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    $stream = $null
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        if ($stream.Length -lt $expected.Length) {
            return $false
        }
        foreach ($expectedByte in $expected) {
            if ($stream.ReadByte() -ne $expectedByte) {
                return $false
            }
        }
        return $true
    }
    finally {
        if ($null -ne $stream) {
            $stream.Dispose()
        }
    }
}

function Find-Executable {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Names,
        [string[]]$FallbackPaths = @()
    )

    foreach ($name in $Names) {
        $command = Get-Command -Name $name -CommandType Application -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($null -ne $command) {
            return $command.Source
        }
    }

    foreach ($path in $FallbackPaths) {
        if (-not [string]::IsNullOrWhiteSpace($path) -and (Test-Path -LiteralPath $path -PathType Leaf)) {
            return (Get-Item -LiteralPath $path).FullName
        }
    }

    return $null
}

function Invoke-NativeTool {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string[]]$ArgumentList
    )

    $previousPreference = $ErrorActionPreference
    $output = @()
    $exitCode = 1
    try {
        # Windows PowerShell can surface native stderr as an ErrorRecord. Capture it
        # without allowing a diagnostic line to abort the command before its exit code
        # and generated files can be checked.
        $ErrorActionPreference = "Continue"
        $output = @(& $FilePath @ArgumentList 2>&1)
        if ($null -ne $LASTEXITCODE) {
            $exitCode = [int]$LASTEXITCODE
        }
    }
    catch {
        $output += $_
        $exitCode = 1
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output = @($output | ForEach-Object { [string]$_ })
    }
}

function Write-ToolOutput {
    param([string[]]$Lines)

    foreach ($line in $Lines) {
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            Write-Host "  $line"
        }
    }
}

function Remove-PublishedPreviewArtifacts {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PreviewPath
    )

    if (-not (Test-Path -LiteralPath $PreviewPath -PathType Container)) {
        return
    }
    $publishedPdf = Join-Path $PreviewPath "sample.pdf"
    if (Test-Path -LiteralPath $publishedPdf -PathType Leaf) {
        Remove-Item -LiteralPath $publishedPdf -Force
    }
    Get-ChildItem -LiteralPath $PreviewPath -Filter "slide-*.png" -File -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
}

function Publish-PreviewArtifacts {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePdf,
        [System.IO.FileInfo[]]$Images = @(),
        [Parameter(Mandatory = $true)]
        [string]$PreviewPath,
        [Parameter(Mandatory = $true)]
        [string]$TransactionRoot
    )

    New-Item -ItemType Directory -Path $PreviewPath -Force | Out-Null
    $transactionId = [System.Guid]::NewGuid().ToString("N")
    $backupPath = Join-Path $TransactionRoot "publication-backup"
    New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

    $incoming = @()
    $publishedPdf = Join-Path $PreviewPath "sample.pdf"
    $incomingPdf = Join-Path $PreviewPath (".ppt-preview-{0}-sample.pdf.tmp" -f $transactionId)
    $incoming += [PSCustomObject]@{ Temporary = $incomingPdf; Final = $publishedPdf }
    foreach ($image in $Images) {
        $incomingImage = Join-Path $PreviewPath (".ppt-preview-{0}-{1}.tmp" -f $transactionId, $image.Name)
        $incoming += [PSCustomObject]@{
            Temporary = $incomingImage
            Final = Join-Path $PreviewPath $image.Name
        }
    }

    $existing = @()
    if (Test-Path -LiteralPath $publishedPdf -PathType Leaf) {
        $existing += Get-Item -LiteralPath $publishedPdf
    }
    $existing += @(
        Get-ChildItem -LiteralPath $PreviewPath -Filter "slide-*.png" -File -ErrorAction SilentlyContinue
    )

    try {
        Copy-Item -LiteralPath $SourcePdf -Destination $incomingPdf
        foreach ($index in 0..($Images.Count - 1)) {
            if ($Images.Count -eq 0) {
                break
            }
            Copy-Item -LiteralPath $Images[$index].FullName -Destination $incoming[$index + 1].Temporary
        }

        foreach ($entry in $incoming) {
            $temporaryItem = Get-Item -LiteralPath $entry.Temporary
            if ($temporaryItem.Length -le 0) {
                throw "Unable to stage a non-empty preview artifact: $($entry.Temporary)"
            }
        }
        foreach ($oldArtifact in $existing) {
            Copy-Item -LiteralPath $oldArtifact.FullName -Destination (Join-Path $backupPath $oldArtifact.Name)
        }

        try {
            foreach ($oldArtifact in $existing) {
                Remove-Item -LiteralPath $oldArtifact.FullName -Force
            }
            foreach ($entry in $incoming) {
                Move-Item -LiteralPath $entry.Temporary -Destination $entry.Final
            }
        }
        catch {
            Remove-PublishedPreviewArtifacts -PreviewPath $PreviewPath
            Get-ChildItem -LiteralPath $backupPath -File -ErrorAction SilentlyContinue |
                ForEach-Object {
                    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $PreviewPath $_.Name) -Force
                }
            throw
        }
    }
    finally {
        foreach ($entry in $incoming) {
            if (Test-Path -LiteralPath $entry.Temporary -PathType Leaf) {
                Remove-Item -LiteralPath $entry.Temporary -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$inputPath = Get-AbsolutePath -Path $InputPptx -BasePath $projectRoot
$previewPath = Get-AbsolutePath -Path $PreviewDirectory -BasePath $projectRoot
$allowedPreviewPath = Get-AbsolutePath -Path "preview" -BasePath $projectRoot
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("ppt-preview-" + [System.Guid]::NewGuid().ToString("N"))
$exitCode = 0

try {
    Assert-SafePreviewPath -PreviewPath $previewPath -AllowedPreviewPath $allowedPreviewPath
    if (-not (Test-Path -LiteralPath $inputPath -PathType Leaf)) {
        throw "Input presentation does not exist: $inputPath"
    }
    if ([System.IO.Path]::GetExtension($inputPath) -ine ".pptx") {
        throw "Input presentation must be a .pptx file: $inputPath"
    }
    $expectedSlideCount = Get-PresentationSlideCount -PptxPath $inputPath

    $programFiles = [Environment]::GetFolderPath("ProgramFiles")
    $programFilesX86 = [Environment]::GetFolderPath("ProgramFilesX86")
    $localAppData = [Environment]::GetFolderPath("LocalApplicationData")
    $sofficeFallbacks = @(
        (Join-Path $programFiles "LibreOffice\program\soffice.com"),
        (Join-Path $programFiles "LibreOffice\program\soffice.exe"),
        (Join-Path $programFilesX86 "LibreOffice\program\soffice.com"),
        (Join-Path $programFilesX86 "LibreOffice\program\soffice.exe"),
        (Join-Path $localAppData "Programs\LibreOffice\program\soffice.com"),
        (Join-Path $localAppData "Programs\LibreOffice\program\soffice.exe")
    )
    $soffice = Find-Executable -Names @("soffice.com", "soffice", "libreoffice") -FallbackPaths $sofficeFallbacks

    if ($null -eq $soffice) {
        Remove-PublishedPreviewArtifacts -PreviewPath $previewPath
        Write-Warning "Preview skipped: LibreOffice (soffice) was not found. The core PPTX build remains valid."
        Write-Host "Removed stale preview/sample.pdf and preview/slide-*.png artifacts, if present."
        Write-Host "Install LibreOffice, then ensure soffice is on PATH:"
        Write-Host "  winget install --id TheDocumentFoundation.LibreOffice --exact"
        Write-Host "A final visual review in Microsoft PowerPoint is still required."
        return
    }

    $stagingPath = Join-Path $temporaryRoot "staging"
    $profilePath = Join-Path $temporaryRoot "libreoffice-profile"
    New-Item -ItemType Directory -Path $stagingPath -Force | Out-Null
    New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
    $profileUri = ([System.Uri]::new($profilePath + [System.IO.Path]::DirectorySeparatorChar)).AbsoluteUri

    Write-Host "Rendering PDF with LibreOffice: $soffice"
    $libreOfficeResult = Invoke-NativeTool -FilePath $soffice -ArgumentList @(
        "-env:UserInstallation=$profileUri",
        "--headless",
        "--nologo",
        "--nodefault",
        "--nofirststartwizard",
        "--convert-to",
        "pdf:impress_pdf_Export",
        "--outdir",
        $stagingPath,
        $inputPath
    )
    Write-ToolOutput -Lines $libreOfficeResult.Output

    if ($libreOfficeResult.ExitCode -ne 0) {
        throw "LibreOffice PDF conversion failed with exit code $($libreOfficeResult.ExitCode)."
    }

    $stagedPdf = Join-Path $stagingPath (([System.IO.Path]::GetFileNameWithoutExtension($inputPath)) + ".pdf")
    if (-not (Test-Path -LiteralPath $stagedPdf -PathType Leaf)) {
        throw "LibreOffice reported success but did not create the expected PDF: $stagedPdf"
    }
    if ((Get-Item -LiteralPath $stagedPdf).Length -le 0) {
        throw "LibreOffice created an empty PDF: $stagedPdf"
    }

    $publishedPdf = Join-Path $previewPath "sample.pdf"

    $pdftoppm = Find-Executable -Names @("pdftoppm")
    $magick = Find-Executable -Names @("magick")
    $ghostscript = Find-Executable -Names @("gswin64c", "gswin32c", "gs")
    $rasterizerName = $null
    $rasterizerResult = $null

    if ($null -ne $pdftoppm) {
        $rasterizerName = "Poppler pdftoppm"
        Write-Host "Rendering PNG pages with ${rasterizerName}: $pdftoppm"
        $rasterizerResult = Invoke-NativeTool -FilePath $pdftoppm -ArgumentList @(
            "-png",
            "-r",
            [string]$Dpi,
            $stagedPdf,
            (Join-Path $stagingPath "slide")
        )
    }
    elseif ($null -ne $magick -and $null -ne $ghostscript) {
        $rasterizerName = "ImageMagick"
        Write-Host "Rendering PNG pages with ${rasterizerName}: $magick"
        $rasterizerResult = Invoke-NativeTool -FilePath $magick -ArgumentList @(
            "-density",
            [string]$Dpi,
            $stagedPdf,
            "-background",
            "white",
            "-alpha",
            "remove",
            "-alpha",
            "off",
            "-scene",
            "1",
            (Join-Path $stagingPath "slide-%d.png")
        )
    }
    else {
        Publish-PreviewArtifacts -SourcePdf $stagedPdf -PreviewPath $previewPath -TransactionRoot $temporaryRoot
        Write-Warning "PDF created, but PNG previews were skipped because no supported PDF rasterizer was found."
        Write-Host "Install Poppler (pdftoppm), or install both ImageMagick and Ghostscript and add them to PATH."
        Write-Host "PDF: $publishedPdf"
        Write-Host "A final visual review in Microsoft PowerPoint is still required."
        return
    }

    Write-ToolOutput -Lines $rasterizerResult.Output
    if ($rasterizerResult.ExitCode -ne 0) {
        throw "$rasterizerName failed with exit code $($rasterizerResult.ExitCode)."
    }

    $stagedImages = @(
        Get-ChildItem -LiteralPath $stagingPath -Filter "slide-*.png" -File |
            Where-Object { $_.Length -gt 0 } |
            Sort-Object {
                if ($_.BaseName -match '^slide-(\d+)$') {
                    return [int]$Matches[1]
                }
                return [int]::MaxValue
            }
    )
    if ($stagedImages.Count -eq 0) {
        throw "$rasterizerName reported success but did not create any non-empty PNG preview files."
    }
    if ($stagedImages.Count -ne $expectedSlideCount) {
        throw "$rasterizerName created $($stagedImages.Count) PNG file(s), but the PPTX contains $expectedSlideCount slide(s)."
    }

    for ($index = 0; $index -lt $stagedImages.Count; $index += 1) {
        $image = $stagedImages[$index]
        if ($image.BaseName -notmatch '^slide-(\d+)$') {
            throw "$rasterizerName created a PNG with an unexpected filename: $($image.Name)"
        }
        $pageNumber = [int]$Matches[1]
        $expectedPageNumber = $index + 1
        if ($pageNumber -ne $expectedPageNumber) {
            throw "$rasterizerName created a non-contiguous page sequence: expected slide-$expectedPageNumber.png but found $($image.Name)."
        }
        if (-not (Test-PngSignature -Path $image.FullName)) {
            throw "$rasterizerName created a file with an invalid PNG signature: $($image.FullName)"
        }
    }

    $normalizedPath = Join-Path $temporaryRoot "normalized"
    New-Item -ItemType Directory -Path $normalizedPath -Force | Out-Null
    $normalizedImages = @(
        for ($index = 0; $index -lt $stagedImages.Count; $index += 1) {
            $normalizedImage = Join-Path $normalizedPath ("slide-{0}.png" -f ($index + 1))
            Copy-Item -LiteralPath $stagedImages[$index].FullName -Destination $normalizedImage
            Get-Item -LiteralPath $normalizedImage
        }
    )

    Publish-PreviewArtifacts -SourcePdf $stagedPdf -Images $normalizedImages -PreviewPath $previewPath -TransactionRoot $temporaryRoot
    Write-Host "Preview complete: $($normalizedImages.Count) slide image(s) at $Dpi DPI."
    Write-Host "PDF: $publishedPdf"
    Write-Host "PNG pages: $(Join-Path $previewPath 'slide-*.png')"
    Write-Host "Automated preview checks are advisory; a final visual review in Microsoft PowerPoint is required."
}
catch {
    Write-Error -Message ("Preview failed: " + $_.Exception.Message) -ErrorAction Continue
    $exitCode = 1
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        $resolvedTemporaryRoot = [System.IO.Path]::GetFullPath($temporaryRoot)
        $systemTemporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
        $temporaryLeaf = Split-Path -Leaf $resolvedTemporaryRoot
        if ($resolvedTemporaryRoot.StartsWith($systemTemporaryRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
            $temporaryLeaf.StartsWith("ppt-preview-", [System.StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

if ($exitCode -ne 0) {
    exit $exitCode
}
