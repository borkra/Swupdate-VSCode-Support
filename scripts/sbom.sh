#!/bin/bash
# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: 2026 borkra
#
# Generate Software Bill of Materials (SBOM) in CycloneDX and SPDX formats

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Default: generate both formats
FORMATS="${1:-both}"

case "$FORMATS" in
  cyclonedx)
    echo "Generating CycloneDX SBOM..."
    npx @cyclonedx/cdxgen -t javascript -o sbom.cdx.json
    echo "✓ CycloneDX SBOM generated: sbom.cdx.json"
    ;;
  spdx)
    echo "Generating SPDX SBOM..."
    npx @cyclonedx/cdxgen -t javascript -o sbom.spdx.json --format spdx
    echo "✓ SPDX SBOM generated: sbom.spdx.json"
    ;;
  both)
    echo "Generating CycloneDX SBOM..."
    npx @cyclonedx/cdxgen -t javascript -o sbom.cdx.json
    echo "✓ CycloneDX SBOM generated: sbom.cdx.json"
    
    echo "Generating SPDX SBOM..."
    npx @cyclonedx/cdxgen -t javascript -o sbom.spdx.json --format spdx
    echo "✓ SPDX SBOM generated: sbom.spdx.json"
    ;;
  *)
    echo "Usage: $0 [cyclonedx|spdx|both]"
    echo ""
    echo "Generate Software Bill of Materials in specified format(s)."
    echo ""
    echo "Options:"
    echo "  cyclonedx  Generate CycloneDX 1.6 JSON SBOM only"
    echo "  spdx       Generate SPDX 3.0.1 JSON-LD SBOM only"
    echo "  both       Generate both CycloneDX and SPDX (default)"
    exit 1
    ;;
esac
