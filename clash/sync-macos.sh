#!/usr/bin/env bash
# ============================================================
# macOS Clash Verge Rev 全局扩展脚本自动同步工具
# 用法：
#   1) 仅同步一次：
#      curl -fsSL https://raw.githubusercontent.com/ywanght/QX-config/main/clash/sync-macos.sh | bash
#   2) 同步并安装 macOS 开机 + 每 6 小时自动后台同步（launchd）：
#      curl -fsSL https://raw.githubusercontent.com/ywanght/QX-config/main/clash/sync-macos.sh | bash -s -- --install
# ============================================================
set -euo pipefail

SCRIPT_URL="https://raw.githubusercontent.com/ywanght/QX-config/main/clash/clash-verge-script.js"
TARGET_DIR="$HOME/Library/Application Support/io.github.clash-verge-rev.clash-verge-rev/profiles"
TARGET_FILE="$TARGET_DIR/Script.js"
INSTALL_DIR="$HOME/.local/bin"
INSTALLED_SCRIPT="$INSTALL_DIR/sync-clash-verge-script.sh"
PLIST_PATH="$HOME/Library/LaunchAgents/com.wanght.sync-clash-verge-script.plist"

sync_once() {
  mkdir -p "$TARGET_DIR"
  local tmp_file
  tmp_file="$(mktemp)"
  trap 'rm -f "$tmp_file"' RETURN

  curl -fsSL --connect-timeout 15 --max-time 30 "$SCRIPT_URL" -o "$tmp_file"

  # 基本合法性检查，防止拉到 404/错误页覆盖本地脚本
  if ! grep -q "function main(" "$tmp_file"; then
    echo "[ERROR] 下载内容异常，未检测到 function main(，已放弃覆盖。" >&2
    exit 1
  fi

  local new_hash old_hash
  new_hash="$(shasum -a 256 "$tmp_file" | awk '{print $1}')"
  if [[ -f "$TARGET_FILE" ]]; then
    old_hash="$(shasum -a 256 "$TARGET_FILE" | awk '{print $1}')"
  else
    old_hash=""
  fi

  if [[ "$new_hash" != "$old_hash" ]]; then
    cp "$tmp_file" "$TARGET_FILE"
    echo "[UPDATED] 已更新 macOS Clash Verge Rev 全局扩展脚本: $TARGET_FILE"
  else
    echo "[UP-TO-DATE] 全局扩展脚本已是最新，无需更新。"
  fi
}

install_launchd() {
  mkdir -p "$INSTALL_DIR" "$HOME/Library/LaunchAgents"
  curl -fsSL "$SCRIPT_URL" >/dev/null # 先验证网络
  curl -fsSL "https://raw.githubusercontent.com/ywanght/QX-config/main/clash/sync-macos.sh" -o "$INSTALLED_SCRIPT"
  chmod +x "$INSTALLED_SCRIPT"

  cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.wanght.sync-clash-verge-script</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$INSTALLED_SCRIPT</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>21600</integer>
  <key>StandardOutPath</key>
  <string>/tmp/sync-clash-verge-script.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/sync-clash-verge-script.err</string>
</dict>
</plist>
EOF

  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  launchctl load "$PLIST_PATH"
  echo "[OK] 已安装 macOS 自动同步任务 (launchd)：登录时 & 每 6 小时自动同步 Script.js"
}

sync_once
if [[ "${1:-}" == "--install" ]]; then
  install_launchd
fi
