#!/usr/bin/env bash
set -e

echo "=========================================="
echo " Starting Local Pre-Flight Verification   "
echo "=========================================="

# 1. Type Checking
echo "-> Running TypeScript compiler check..."
npx tsc --noEmit
echo "✓ Type check passed."

# 2. Linting
echo "-> Running ESLint..."
npm run lint
echo "✓ Linting passed."

# 3. Clean previous build artifacts
echo "-> Cleaning old build artifacts..."
rm -rf .next deploy-package deploy.tar.gz

# 4. Production Build
echo "-> Building Next.js application for production..."
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
npm run build
echo "✓ Build completed successfully."

# 5. Package Standalone Bundle Verification
echo "-> Packaging standalone bundle..."
mkdir -p deploy-package
cp -a .next/standalone/. deploy-package/
mkdir -p deploy-package/.next/static
cp -a .next/static/. deploy-package/.next/static/

if [ -d public ]; then cp -a public deploy-package/; fi
if [ -f ecosystem.config.js ]; then cp ecosystem.config.js deploy-package/; fi

tar -czf deploy.tar.gz -C deploy-package .
echo "✓ Bundle packed successfully: $(du -h deploy.tar.gz | cut -f1)"

echo "=========================================="
echo " All checks passed! Ready to push to tdevops."
echo "==========================================":
