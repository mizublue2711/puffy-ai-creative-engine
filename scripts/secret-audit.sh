#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo -e "${BLUE}==> [1/3] Initializing Secret & Repository Hygiene Audit...${NC}"

SCAN_MODE="${1:-all}"
TMP_DIFF="$(mktemp)"
trap 'rm -f "$TMP_DIFF"' EXIT

if [ "$SCAN_MODE" = "--staged" ]; then
    echo -e "${YELLOW}Mode: Scanning Git Staged changes...${NC}"
    git diff --cached --diff-filter=ACMR -U0 -- . ':(exclude)node_modules' ':(exclude)dist' ':(exclude).git' \
        | awk '/^\+\+\+ /{file=$0; sub(/^\+\+\+ (b\/|"b\/)/, "", file); sub(/"$/, "", file); next} /^\+/{print file ":" substr($0,2)}' \
        > "$TMP_DIFF" 2>/dev/null || true
else
    echo -e "${YELLOW}Mode: Scanning tracked repository files...${NC}"
    git grep -I -n -E "" -- . ':(exclude)node_modules' ':(exclude)dist' ':(exclude).git' > "$TMP_DIFF" 2>/dev/null || true
fi

# Case-sensitive high-risk token & credential signatures
# (Case-sensitive avoids false positives on base64 image blobs such as embedded PNGs in SVGs)
CASE_SENSITIVE_PATTERNS=(
    'AIza[0-9A-Za-z_-]{35}'
    'AKIA[0-9A-Z]{16}'
    'ghp_[0-9a-zA-Z]{36}'
    'github_pat_[0-9a-zA-Z_]{82}'
    '-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'
    'xox[baprs]-[0-9a-zA-Z]{10,48}'
    'https://hooks\.slack\.com/services/T[0-9A-Z]{8,}/B[0-9A-Z]{8,}/[0-9A-Za-z]{20,}'
)

# Case-insensitive generic key/token assignment signatures
CASE_INSENSITIVE_PATTERNS=(
    "(api[_-]?key|secret[_-]?key|access[_-]?token)[[:space:]]*[:=][[:space:]]*['\"][0-9a-zA-Z_-]{20,}['\"]"
)

LEAK_FOUND=0

echo -e "${BLUE}==> [2/3] Checking against credential signatures...${NC}"

if [ -s "$TMP_DIFF" ]; then
    for pattern in "${CASE_SENSITIVE_PATTERNS[@]}"; do
        MATCHES="$(grep -E -e "$pattern" "$TMP_DIFF" || true)"
        if [ -n "$MATCHES" ]; then
            echo -e "${RED}[VIOLATION] Exposed secret pattern detected: ${NC}$pattern"
            echo "$MATCHES" | head -n 5 | cut -c1-160 | sed 's/^/   /'
            echo -e "${RED}------------------------------------------------------------${NC}"
            LEAK_FOUND=1
        fi
    done

    for pattern in "${CASE_INSENSITIVE_PATTERNS[@]}"; do
        MATCHES="$(grep -E -i -e "$pattern" "$TMP_DIFF" || true)"
        if [ -n "$MATCHES" ]; then
            echo -e "${RED}[VIOLATION] Exposed secret pattern detected: ${NC}$pattern"
            echo "$MATCHES" | head -n 5 | cut -c1-160 | sed 's/^/   /'
            echo -e "${RED}------------------------------------------------------------${NC}"
            LEAK_FOUND=1
        fi
    done
fi

# Check for staged or tracked unignored environment/secret files
CHECK_ENV_FILES="$(git ls-files | grep -E '(^|/)\.env(\.[^/]+)?$|(^|/)auth_cookies\.json$|(^|/)\.secrets/' | grep -v -E '(^|/)\.env\.example$' || true)"
if [ -n "$CHECK_ENV_FILES" ]; then
    echo -e "${RED}[VIOLATION] Tracked/staged environment or secret file detected in git index:${NC}"
    echo "$CHECK_ENV_FILES" | sed 's/^/   /'
    LEAK_FOUND=1
fi

if command -v gitleaks &> /dev/null; then
    echo -e "${BLUE}==> [3/3] Running Gitleaks engine scan...${NC}"
    if [ "$SCAN_MODE" = "--staged" ]; then
        gitleaks protect --staged --verbose --redact || LEAK_FOUND=1
    else
        gitleaks detect --source . --verbose --redact || LEAK_FOUND=1
    fi
else
    echo -e "${YELLOW}==> [3/3] Gitleaks not installed locally. Basic regex check complete.${NC}"
fi

if [ "$LEAK_FOUND" -ne 0 ]; then
    echo -e "${RED}============================================================${NC}"
    echo -e "${RED}❌ AUDIT FAILED: High-risk secrets found in codebase!${NC}"
    echo -e "${RED}Revoke credentials and isolate them in environment variables.${NC}"
    echo -e "${RED}============================================================${NC}"
    exit 1
else
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}✅ AUDIT PASSED: Repository clean. Zero leaked secrets found.${NC}"
    echo -e "${GREEN}============================================================${NC}"
    exit 0
fi
