#!/usr/bin/env python3
"""
将圈X主规则 (rules/*.list) 自动转换为 Clash / Mihomo rule-providers 格式 (clash/rules/*.yaml)
用法: python scripts/convert_qx_to_clash.py
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
RULES_DIR = ROOT / "rules"
OUT_DIR = ROOT / "clash" / "rules"
OUT_DIR.mkdir(parents=True, exist_ok=True)

QX_TO_CLASH_TYPE = {
    "host": "DOMAIN",
    "domain": "DOMAIN",
    "host-suffix": "DOMAIN-SUFFIX",
    "domain-suffix": "DOMAIN-SUFFIX",
    "host-keyword": "DOMAIN-KEYWORD",
    "domain-keyword": "DOMAIN-KEYWORD",
    "host-wildcard": "DOMAIN-WILDCARD",
    "ip-cidr": "IP-CIDR",
    "ip6-cidr": "IP-CIDR6",
    "ip-asn": "IP-ASN",
    "geoip": "GEOIP",
}

IP_REGEX = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def convert_qx_list(src: Path, dst: Path) -> int:
    payload = []
    seen = set()
    for raw_line in src.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith(";"):
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 2:
            continue
        rtype = parts[0].lower()
        value = parts[1].strip()
        if not value:
            continue

        clash_type = QX_TO_CLASH_TYPE.get(rtype)
        if not clash_type:
            continue

        # 修正误把纯 IP 写成 host 的情况
        if clash_type == "DOMAIN" and IP_REGEX.match(value):
            clash_type = "IP-CIDR"
            value = f"{value}/32"

        # 兼容 IP-CIDR 默认加 no-resolve，避免额外 DNS 查询拖慢直连
        if clash_type in ("IP-CIDR", "IP-CIDR6"):
            entry = f"{clash_type},{value},no-resolve"
        else:
            entry = f"{clash_type},{value}"

        if entry not in seen:
            seen.add(entry)
            payload.append(entry)

    lines = [
        f"# Auto-generated from {src.relative_to(ROOT).as_posix()}",
        "# DO NOT EDIT MANUALLY — edit the source .list file in rules/ instead.",
        "payload:",
    ]
    for item in payload:
        lines.append(f"  - '{item}'")
    dst.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    return len(payload)


def convert_process_list(src: Path, dst: Path) -> int:
    payload = []
    seen = set()
    for raw_line in src.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith(";"):
            continue
        # 支持直接写进程名，也兼容写 PROCESS-NAME,xxx.exe
        if "," in line:
            parts = [p.strip() for p in line.split(",")]
            entry = f"PROCESS-NAME,{parts[1]}" if parts[0].upper() == "PROCESS-NAME" and len(parts) >= 2 else line
        else:
            entry = f"PROCESS-NAME,{line}"
        if entry not in seen:
            seen.add(entry)
            payload.append(entry)

    lines = [
        f"# Auto-generated from {src.relative_to(ROOT).as_posix()}",
        "# DO NOT EDIT MANUALLY — edit rules/desktop-process.list instead.",
        "payload:",
    ]
    for item in payload:
        lines.append(f"  - '{item}'")
    dst.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    return len(payload)


def main():
    mapping = [
        ("direct.list", "direct.yaml", convert_qx_list),
        ("reject.list", "reject.yaml", convert_qx_list),
        ("ai-general.list", "ai-general.yaml", convert_qx_list),
        ("ai-claude.list", "ai-claude.yaml", convert_qx_list),
        ("desktop-process.list", "desktop-process.yaml", convert_process_list),
    ]
    for src_name, dst_name, fn in mapping:
        src = RULES_DIR / src_name
        dst = OUT_DIR / dst_name
        if src.exists():
            count = fn(src, dst)
            print(f"[OK] {src_name} -> clash/rules/{dst_name} ({count} rules)")
        else:
            print(f"[SKIP] {src_name} not found")


if __name__ == "__main__":
    main()
