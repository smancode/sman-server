#!/bin/bash
set -euo pipefail

# ── 配置 ──
STAGING_DIR="staging2/sman-server"
CONF_FILE="deploy-private/pack.conf"
if [ ! -f "$CONF_FILE" ]; then
  echo "ERROR: $CONF_FILE not found"
  echo "Create it with:"
  echo "  SMAN_UPDATE_URL=http://host:port/updates/sman"
  echo "  SMAN_HUB_URL=http://host:port"
  exit 1
fi
source "$CONF_FILE"
DEPLOY_UPDATE_URL="$SMAN_UPDATE_URL"
DEPLOY_HUB_URL="$SMAN_HUB_URL"

# ── 版本号: 26.MMDD.HH ──
VERSION="26.$(date +%-m%d).$(date +%H)"
ZIP_FILE="sman-server-${VERSION}.zip"

echo "=== sman-server packer ==="
echo "Version: ${VERSION}"
echo ""

# 1. 切换到 x64 Node
echo "[1/7] Switching to x64 Node..."
eval "$(fnm env)" && fnm use 22 --arch x64
echo "  Node: $(node -v), arch: $(node -p process.arch)"

# 2. 安装服务端依赖 (x64)
echo "[2/7] Installing server dependencies (x64)..."
rm -rf node_modules && pnpm install

# 3. 安装 web 依赖 (x64)
echo "[3/7] Installing web dependencies (x64)..."
cd web && rm -rf node_modules && pnpm install && pnpm add -D @rollup/rollup-win32-x64-msvc && cd ..

# 4. 构建
echo "[4/7] Building..."
SMAN_UPDATE_URL="$DEPLOY_UPDATE_URL" SMAN_HUB_URL="$DEPLOY_HUB_URL" pnpm build

# 5. 准备打包目录
echo "[5/7] Preparing staging directory..."
rm -rf "$STAGING_DIR" && mkdir -p "$STAGING_DIR"
cp -r dist "$STAGING_DIR/"
cp .env.example "$STAGING_DIR/"
cp package.json "$STAGING_DIR/"

# start.sh
cat > "$STAGING_DIR/start.sh" << STARTSH
#!/bin/bash
SCRIPT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
cd "\$SCRIPT_DIR"

export SMAN_UPDATE_URL=$DEPLOY_UPDATE_URL
export SMAN_HUB_URL=$DEPLOY_HUB_URL

./node.exe dist/index.js
STARTSH

# node.exe
cp "$(which node)" "$STAGING_DIR/node.exe"

# 安装生产依赖
cd "$STAGING_DIR"
echo "  Installing production dependencies..."
pnpm install --prod --shamefully-hoist
cd - > /dev/null

# 6. 验证
echo "[6/7] Verifying..."
cd "$STAGING_DIR"

# node.exe 架构
NODE_ARCH=$(python -c "
import struct
f = open('node.exe', 'rb')
f.seek(0x3c); pe_off = struct.unpack('<I', f.read(4))[0]
f.seek(pe_off+4); machine = struct.unpack('<H', f.read(2))[0]
f.close()
print('x64' if machine == 0x8664 else 'ARM64' if machine == 0xAA64 else 'unknown')
")
if [ "$NODE_ARCH" != "x64" ]; then
    echo "  FAIL: node.exe is $NODE_ARCH, expected x64"
    exit 1
fi
echo "  node.exe: $NODE_ARCH OK"

# better_sqlite3.node 架构
SQLITE_NODE=$(find node_modules -name "better_sqlite3.node" | head -1)
if [ -n "$SQLITE_NODE" ]; then
    SQLITE_ARCH=$(python -c "
import struct
f = open('$SQLITE_NODE', 'rb')
f.seek(0x3c); pe_off = struct.unpack('<I', f.read(4))[0]
f.seek(pe_off+4); machine = struct.unpack('<H', f.read(2))[0]
f.close()
print('x64' if machine == 0x8664 else 'ARM64' if machine == 0xAA64 else 'unknown')
")
    if [ "$SQLITE_ARCH" != "x64" ]; then
        echo "  FAIL: better_sqlite3.node is $SQLITE_ARCH, expected x64"
        exit 1
    fi
    echo "  better_sqlite3.node: $SQLITE_ARCH OK"
fi

# 符号链接检查
SYMLINK_COUNT=$(python -c "
import os
count = 0
for root, dirs, files in os.walk('node_modules'):
    for name in dirs + files:
        if os.path.islink(os.path.join(root, name)):
            count += 1
print(count)
")
if [ "$SYMLINK_COUNT" -gt 0 ]; then
    echo "  FAIL: Found $SYMLINK_COUNT symlinks in node_modules"
    exit 1
fi
echo "  symlinks: $SYMLINK_COUNT OK"

# 模块加载测试
./node.exe -e "
Promise.all(['better-sqlite3', 'express', 'dotenv'].map(m =>
  import(m).then(() => console.log('  ' + m + ': OK'))
  .catch(e => { console.log('  ' + m + ': FAIL ' + e.message); process.exitCode = 1 })
))
" 2>&1
if [ $? -ne 0 ]; then
    echo "  FAIL: Module loading test failed"
    exit 1
fi

cd - > /dev/null

# 7. 打包
echo "[7/7] Creating zip..."
cd staging2
npx bestzip "../${ZIP_FILE}" sman-server/
cd ..

ZIP_SIZE=$(ls -lh "$ZIP_FILE" | awk '{print $5}')
echo ""
echo "=== Done: ${ZIP_FILE} (${ZIP_SIZE}) ==="
