#!/usr/bin/env python3
"""
Seed GitHub Issues + Project v2 items from docs/TECH_DEBT.md (capability-centric).

✅ Windows-safe + Project v2 safe:
- Resolves gh.exe without relying on PATH (shutil.which + common install paths)
- Forces UTF-8 decoding for subprocess output (prevents cp1252 UnicodeDecodeError)
- Better gh/GraphQL error messages + scope hints
- Idempotent project linking: if already in project, finds item id and still sets fields
- Optional label bootstrap (prevents "label does not exist" failures)
- Domain fallback from capability_id prefix when Domínio missing

Requirements:
- gh CLI installed and authenticated:
  - gh auth login
  - For Projects v2: gh auth refresh -s read:project,project

Usage:
  # Dry-run
  python scripts/antigravity/seed_github_project.py --tech-debt docs/TECH_DEBT.md

  # Apply: issues + project v2 + bootstrap labels
  python scripts/antigravity/seed_github_project.py \
    --tech-debt docs/TECH_DEBT.md \
    --project-owner maresdeandrade \
    --project-number 1 \
    --apply \
    --bootstrap-labels \
    --update-existing

Windows PowerShell tip:
  py -3 -X utf8 scripts/antigravity/seed_github_project.py ...
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import unicodedata
import shutil
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


# -----------------------------
# Models
# -----------------------------

@dataclass
class TDItem:
    td_id: str
    title: str
    capability_id: str
    track: str                 # Catalog | Infra
    severity: str              # P0 | P1 | P2
    domain: str                # sanitario|pesagem|nutricao|movimentacao|reproducao|financeiro|agenda|platform
    risk: str
    evidence: str
    action: str
    acceptance: List[str]
    baseline: str


# -----------------------------
# GH executable resolution (no PATH dependency)
# -----------------------------

_GH_EXE: Optional[str] = None

def resolve_gh_exe() -> str:
    """
    Resolve gh executable path:
    1) env var GH_EXE / GH_PATH
    2) shutil.which("gh")
    3) common install paths (Windows)
    Cached after first resolve.
    """
    global _GH_EXE
    if _GH_EXE:
        return _GH_EXE

    # 1) env overrides
    for env_key in ("GH_EXE", "GH_PATH"):
        p = os.environ.get(env_key, "").strip()
        if p and os.path.isfile(p):
            _GH_EXE = p
            return _GH_EXE

    # 2) PATH lookup
    which = shutil.which("gh")
    if which and os.path.isfile(which):
        _GH_EXE = which
        return _GH_EXE

    # 3) common Windows locations
    candidates = [
        r"C:\Program Files\GitHub CLI\gh.exe",
        r"C:\Program Files (x86)\GitHub CLI\gh.exe",
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "GitHub CLI", "gh.exe"),
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            _GH_EXE = c
            return _GH_EXE

    raise RuntimeError(
        "GitHub CLI (gh) not found.\n"
        "Fix options:\n"
        "  1) Reopen PowerShell (refresh PATH)\n"
        "  2) Set env var GH_EXE to full path (example):\n"
        "     setx GH_EXE \"C:\\Program Files\\GitHub CLI\\gh.exe\"\n"
        "  3) Install:\n"
        "     winget install --id GitHub.cli -e"
    )


# -----------------------------
# Robust subprocess runner (UTF-8 safe)
# -----------------------------

def run(cmd: List[str], check: bool = True) -> str:
    """
    Run a command and return stdout.
    - If cmd starts with 'gh', replace with resolved gh.exe path.
    - Forces UTF-8 decode (Windows-safe)
    - Captures stderr and shows it on failures
    """
    if not cmd:
        raise ValueError("Empty command")

    # Replace gh with resolved path
    if cmd[0] == "gh":
        cmd = [resolve_gh_exe(), *cmd[1:]]

    env = os.environ.copy()
    env.setdefault("GH_PAGER", "cat")
    env.setdefault("PYTHONUTF8", "1")
    env.setdefault("LANG", "C.UTF-8")
    env.setdefault("LC_ALL", "C.UTF-8")

    p = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )
    stdout = (p.stdout or "").strip()
    stderr = (p.stderr or "").strip()

    if check and p.returncode != 0:
        raise RuntimeError(
            f"Command failed ({p.returncode}): {' '.join(cmd)}\n"
            f"STDERR:\n{stderr}\n"
            f"STDOUT:\n{stdout}"
        )

    return stdout


# -----------------------------
# GH helpers
# -----------------------------

def ensure_gh_available() -> None:
    # Just resolving gh already validates existence
    gh = resolve_gh_exe()
    _ = run([gh, "--version"])  # uses absolute path now

def gh_api_json(args: List[str]) -> dict:
    out = run(["gh", "api", *args])
    if not out:
        return {}
    try:
        return json.loads(out)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse JSON from gh api.\nOutput:\n{out}") from e

def gh_graphql(query: str, variables: dict) -> dict:
    """
    gh api graphql expects variables as individual fields:
      --raw-field login=... --field number=...
    (NOT a JSON blob "variables={...}")
    """
    # minify query to reduce Windows quoting edge cases
    q = " ".join(query.split())

    cmd = ["gh", "api", "graphql", "--raw-field", f"query={q}"]

    for k, v in (variables or {}).items():
        if v is None:
            raise RuntimeError(f"GraphQL variable '{k}' is None (expected non-null).")

        # `--field` keeps numeric/bool types; `--raw-field` for strings
        if isinstance(v, bool):
            cmd += ["--field", f"{k}={'true' if v else 'false'}"]
        elif isinstance(v, int):
            cmd += ["--field", f"{k}={v}"]
        else:
            cmd += ["--raw-field", f"{k}={str(v)}"]

    out = run(cmd)
    if not out:
        return {}

    try:
        data = json.loads(out)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse JSON from gh api graphql.\nOutput:\n{out}") from e

    if isinstance(data, dict) and data.get("errors"):
        errs = json.dumps(data["errors"], ensure_ascii=False, indent=2)
        raise RuntimeError(
            f"GraphQL returned errors:\n{errs}\n\n"
            "Ensure Projects v2 scopes:\n"
            "  gh auth refresh -s read:project,project"
        )

    return data

def detect_repo_name_with_owner() -> str:
    out = run(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])
    if "/" not in out:
        raise RuntimeError("Could not infer repo. Provide --repo OWNER/REPO.")
    return out


# -----------------------------
# Parsing helpers
# -----------------------------

def normalize_text(s: str) -> str:
    s = s.strip().lower()
    s = unicodedata.normalize("NFKD", s)
    return "".join(ch for ch in s if not unicodedata.combining(ch))

def milestone_from_severity(sev: str) -> str:
    return {"P0": "M0", "P1": "M1", "P2": "M2"}.get(sev, "M2")

def domain_from_capability_id(cap_id: str, track: str) -> str:
    if track.lower() == "infra":
        return "platform"
    prefix = (cap_id.split(".", 1)[0] if "." in cap_id else cap_id).strip().lower()
    if prefix in {"sanitario", "pesagem", "nutricao", "movimentacao", "reproducao", "financeiro", "agenda"}:
        return prefix
    return "platform"

def safe_domain_from_doc(domain_raw: str, track: str, cap_id: str) -> str:
    if not domain_raw.strip():
        return domain_from_capability_id(cap_id, track)

    d = normalize_text(domain_raw)
    mapping = {
        "sanitario": "sanitario",
        "pesagem": "pesagem",
        "nutricao": "nutricao",
        "movimentacao": "movimentacao",
        "reproducao": "reproducao",
        "financeiro": "financeiro",
        "agenda": "agenda",
        "platform": "platform",
    }
    for k, v in mapping.items():
        if k in d:
            return v
    return domain_from_capability_id(cap_id, track)


# -----------------------------
# TECH_DEBT parser (Rev D+ style, robust)
# -----------------------------

TD_HEADING_RE = re.compile(r"^####\s+(TD-\d+):\s+(.*)\s*$")
BASELINE_RE_LIST = [
    re.compile(r"^\s*>\s*\*\*Baseline:\*\*\s*`([^`]+)`\s*$"),
    re.compile(r"^\s*\*\*Baseline:\*\*\s*`([^`]+)`\s*$"),
    re.compile(r"^\s*Baseline:\s*`?([A-Za-z0-9._-]+)`?\s*$"),
]

OPEN_CATALOG_RE = re.compile(r"^##\s+OPEN\s+\(Catalog\)", re.IGNORECASE)
OPEN_INFRA_RE = re.compile(r"^##\s+OPEN\s+\(Infra/Out-of-catalog\)", re.IGNORECASE)
CLOSED_RE = re.compile(r"^##\s+.*CLOSED", re.IGNORECASE)
SEVERITY_RE = re.compile(r"\b(P0|P1|P2)\b")

CAP_ID_RE = re.compile(r"^\-\s+\*\*capability_id:\*\*\s+`([^`]+)`")
DOMAIN_RE = re.compile(r"^\-\s+\*\*Dom[ií]nio:\*\*\s+(.*)")
RISK_RE = re.compile(r"^\-\s+\*\*Risco:\*\*\s+(.*)")
EVID_RE = re.compile(r"^\-\s+\*\*Evid[eê]ncia:\*\*\s+(.*)")
ACTION_RE = re.compile(r"^\-\s+\*\*A[cç][aã]o:\*\*\s+(.*)")
ACCEPT_START_RE = re.compile(r"^\-\s+\*\*Crit[eé]rio de Aceite:\*\*\s*$")
ACCEPT_ITEM_RE = re.compile(r"^\s*[\-\*]\s+\[[ xX]\]\s+(.*)\s*$")

def parse_tech_debt(path: str) -> List[TDItem]:
    raw = open(path, "r", encoding="utf-8").read().splitlines()

    baseline = "UNKNOWN"
    for line in raw[:120]:
        s = line.strip()
        for rx in BASELINE_RE_LIST:
            m = rx.match(s)
            if m:
                baseline = m.group(1).strip()
                break
        if baseline != "UNKNOWN":
            break

    items: List[TDItem] = []
    section: Optional[str] = None  # Catalog | Infra | None
    severity: Optional[str] = None

    i = 0
    while i < len(raw):
        line = raw[i].rstrip()

        if CLOSED_RE.match(line):
            section = None
        elif OPEN_CATALOG_RE.match(line):
            section = "Catalog"
        elif OPEN_INFRA_RE.match(line):
            section = "Infra"

        if line.startswith("###") and SEVERITY_RE.search(line):
            severity = SEVERITY_RE.search(line).group(1)

        m = TD_HEADING_RE.match(line)
        if m and section in ("Catalog", "Infra") and severity in ("P0", "P1", "P2"):
            td_id = m.group(1).strip()
            title = m.group(2).strip()

            cap_id = ""
            domain_raw = ""
            risk = ""
            evid = ""
            action = ""
            acceptance: List[str] = []

            j = i + 1
            in_accept = False

            while j < len(raw):
                l2 = raw[j].rstrip()
                if TD_HEADING_RE.match(l2) or l2.startswith("## "):
                    break

                s2 = l2.strip()
                if (mm := CAP_ID_RE.match(s2)):
                    cap_id = mm.group(1).strip()
                elif (mm := DOMAIN_RE.match(s2)):
                    domain_raw = mm.group(1).strip()
                elif (mm := RISK_RE.match(s2)):
                    risk = mm.group(1).strip()
                elif (mm := EVID_RE.match(s2)):
                    evid = mm.group(1).strip()
                elif (mm := ACTION_RE.match(s2)):
                    action = mm.group(1).strip()
                elif ACCEPT_START_RE.match(s2):
                    in_accept = True
                elif in_accept and (mm := ACCEPT_ITEM_RE.match(l2)):
                    acceptance.append(mm.group(1).strip())

                j += 1

            if not cap_id:
                i = j
                continue

            domain = safe_domain_from_doc(domain_raw, section, cap_id)

            items.append(
                TDItem(
                    td_id=td_id,
                    title=title,
                    capability_id=cap_id,
                    track=section,
                    severity=severity,
                    domain=domain,
                    risk=risk or "N/A",
                    evidence=evid or "N/A",
                    action=action or "N/A",
                    acceptance=acceptance,
                    baseline=baseline,
                )
            )

            i = j
            continue

        i += 1

    return items


# -----------------------------
# Labels bootstrap (optional)
# -----------------------------

def ensure_labels_exist(repo: str) -> None:
    label_specs = [
        ("capability", "0E8A16", "Capability-centric work item"),
        ("sev:P0", "B60205", "P0: security/integrity/offline-core"),
        ("sev:P1", "D93F0B", "P1: validations/referential integrity"),
        ("sev:P2", "FBCA04", "P2: perf/observability/ux"),
        ("track:catalog", "1D76DB", "Catalog capability"),
        ("track:infra", "5319E7", "Infra/out-of-catalog"),
        ("milestone:M0", "B60205", "M0 (Weeks 1-2): all P0"),
        ("milestone:M1", "D93F0B", "M1 (Weeks 3-4): all P1"),
        ("milestone:M2", "FBCA04", "M2 (Weeks 5-6): all P2"),
    ]
    domains = ["sanitario","pesagem","nutricao","movimentacao","reproducao","financeiro","agenda","platform"]
    for d in domains:
        label_specs.append((f"domain:{d}", "C5DEF5", f"Domain {d}"))

    for name, color, desc in label_specs:
        run(["gh", "label", "create", name, "--color", color, "--description", desc, "--force", "-R", repo], check=False)


# -----------------------------
# GitHub Issue operations
# -----------------------------

def labels_for_item(item: TDItem) -> List[str]:
    return [
        "capability",
        f"sev:{item.severity}",
        f"track:{'catalog' if item.track == 'Catalog' else 'infra'}",
        f"domain:{item.domain}",
        f"milestone:{milestone_from_severity(item.severity)}",
    ]

def build_issue_body(item: TDItem) -> str:
    acc = "\n".join([f"- [ ] {x}" for x in item.acceptance]) if item.acceptance else "- [ ] (definir)"
    milestone = milestone_from_severity(item.severity)
    return f"""## Contexto
- **capability_id:** `{item.capability_id}`
- **TD-ID:** `{item.td_id}`
- **Track:** {item.track}
- **Severidade:** {item.severity} ({milestone})
- **Domínio:** {item.domain}
- **Baseline (docs):** `{item.baseline}`

## Risco
{item.risk}

## Evidência (mínima)
{item.evidence}

## Ação sugerida
{item.action}

## Critério de aceite (mensurável)
{acc}

## Definição de Done (DoD)
- `gap({item.capability_id}) == FALSE` no `docs/IMPLEMENTATION_STATUS.md` (ou item infra resolvido)
- Docs derivados regen e RECONCILIACAO_REPORT confirmam consistência
"""

def find_existing_issue_number(repo: str, capability_id: str) -> Optional[int]:
    query = f"\"[{capability_id}]\" in:title"
    out = run([
        "gh", "issue", "list",
        "-R", repo,
        "--state", "all",
        "--search", query,
        "--json", "number,title,state"
    ])
    data = json.loads(out) if out else []
    if not data:
        return None
    open_issues = [x for x in data if x.get("state") == "OPEN"]
    pick = open_issues[0] if open_issues else data[0]
    return int(pick["number"])

def get_issue_node_id(repo: str, number: int) -> str:
    owner, name = repo.split("/", 1)
    issue = gh_api_json(["repos", owner, name, "issues", str(number)])
    node_id = issue.get("node_id", "")
    if not node_id:
        raise RuntimeError(f"Could not fetch node_id for issue #{number}")
    return node_id

def create_issue(repo: str, title: str, body: str, labels: List[str]) -> Tuple[int, str, str]:
    owner, name = repo.split("/", 1)
    args = ["-X", "POST", f"repos/{owner}/{name}/issues", "-f", f"title={title}", "-f", f"body={body}"]
    for lab in labels:
        args += ["-f", f"labels[]={lab}"]
    resp = gh_api_json(args)
    return int(resp["number"]), resp.get("html_url", ""), resp.get("node_id", "")

def update_issue(repo: str, number: int, body: Optional[str], add_labels: Optional[List[str]]) -> None:
    owner, name = repo.split("/", 1)
    args = ["-X", "PATCH", f"repos/{owner}/{name}/issues/{number}"]
    if body is not None:
        args += ["-f", f"body={body}"]
    gh_api_json(args)

    if add_labels:
        run(["gh", "issue", "edit", str(number), "-R", repo, "--add-label", ",".join(add_labels)], check=False)


# -----------------------------
# Project v2 operations
# -----------------------------

PROJECT_QUERY = r"""
query($login: String!, $number: Int!) {
  organization(login: $login) {
    projectV2(number: $number) {
      id
      title
      fields(first: 100) {
        nodes {
          __typename
          ... on ProjectV2FieldCommon { id name }
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
    }
  }
  user(login: $login) {
    projectV2(number: $number) {
      id
      title
      fields(first: 100) {
        nodes {
          __typename
          ... on ProjectV2FieldCommon { id name }
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
    }
  }
}
"""

ADD_ITEM_MUT = r"""
mutation($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
    item { id }
  }
}
"""

UPDATE_FIELD_MUT = r"""
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId,
    itemId: $itemId,
    fieldId: $fieldId,
    value: $value
  }) {
    projectV2Item { id }
  }
}
"""

FIND_ITEM_BY_CONTENT_QUERY = r"""
query($projectId: ID!, $after: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100, after: $after) {
        nodes {
          id
          content {
            __typename
            ... on Issue { id number }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
"""

def load_project(project_owner: str, project_number: int) -> Tuple[str, Dict[str, dict], str]:
    data = gh_graphql(PROJECT_QUERY, {"login": project_owner, "number": project_number})
    proj = None
    if data.get("data", {}).get("organization", {}).get("projectV2"):
        proj = data["data"]["organization"]["projectV2"]
    elif data.get("data", {}).get("user", {}).get("projectV2"):
        proj = data["data"]["user"]["projectV2"]

    if not proj:
        raise RuntimeError(
            f"Project v2 not found or not accessible: owner={project_owner} number={project_number}\n"
            "Confirm with:\n"
            f"  gh project view {project_number} --owner {project_owner}\n"
            "And ensure scopes:\n"
            "  gh auth refresh -s read:project,project"
        )

    fields = proj.get("fields", {}).get("nodes", []) or []
    by_name: Dict[str, dict] = {}
    for f in fields:
        if f and "name" in f:
            by_name[f["name"]] = f
    return proj["id"], by_name, proj.get("title", "")

def add_issue_to_project(project_id: str, issue_node_id: str) -> str:
    resp = gh_graphql(ADD_ITEM_MUT, {"projectId": project_id, "contentId": issue_node_id})
    return resp["data"]["addProjectV2ItemById"]["item"]["id"]

def find_project_item_id_by_issue_node(project_id: str, issue_node_id: str) -> Optional[str]:
    after = None
    for _ in range(30):  # enough for most boards
        data = gh_graphql(FIND_ITEM_BY_CONTENT_QUERY, {"projectId": project_id, "after": after})
        nodes = data["data"]["node"]["items"]["nodes"]
        page = data["data"]["node"]["items"]["pageInfo"]
        for it in nodes:
            content = it.get("content")
            if content and content.get("__typename") == "Issue" and content.get("id") == issue_node_id:
                return it["id"]
        if not page.get("hasNextPage"):
            return None
        after = page.get("endCursor")
    return None

def ensure_project_item(project_id: str, issue_node_id: str) -> str:
    try:
        return add_issue_to_project(project_id, issue_node_id)
    except RuntimeError as e:
        msg = str(e).lower()
        if "already exists" in msg or "content already exists" in msg:
            existing = find_project_item_id_by_issue_node(project_id, issue_node_id)
            if existing:
                return existing
        raise

def set_text_field(project_id: str, item_id: str, field_id: str, value: str) -> None:
    gh_graphql(UPDATE_FIELD_MUT, {"projectId": project_id, "itemId": item_id, "fieldId": field_id, "value": {"text": value}})

def set_single_select_field(project_id: str, item_id: str, field: dict, option_name: str) -> None:
    options = field.get("options") or []
    opt = next((o for o in options if o["name"] == option_name), None)
    if not opt:
        raise RuntimeError(f"Option '{option_name}' not found for field '{field.get('name')}'.")
    gh_graphql(UPDATE_FIELD_MUT, {"projectId": project_id, "itemId": item_id, "fieldId": field["id"], "value": {"singleSelectOptionId": opt["id"]}})

def try_set_project_fields(
    project_id: str,
    fields_by_name: Dict[str, dict],
    item_id: str,
    item: TDItem,
    desired_status: str,
) -> List[str]:
    warnings: List[str] = []

    def fld(name: str) -> Optional[dict]:
        return fields_by_name.get(name)

    status_field = fld("Status")
    severity_field = fld("Severity")
    track_field = fld("Track")
    domain_field = fld("Domain")
    cap_field = fld("CapabilityID")
    baseline_field = fld("Baseline")
    milestone_field = fld("Milestone")

    desired_sev = item.severity
    desired_track = "Catalog" if item.track == "Catalog" else "Infra"
    desired_domain = item.domain
    desired_cap = item.capability_id
    desired_baseline = item.baseline
    desired_milestone = milestone_from_severity(item.severity)

    def set_select(field: Optional[dict], name: str, value: str):
        if not field:
            warnings.append(f"Missing Project field: {name}")
            return
        if field.get("__typename") != "ProjectV2SingleSelectField":
            warnings.append(f"{name} exists but is not single-select; skipping.")
            return
        try:
            set_single_select_field(project_id, item_id, field, value)
        except Exception as e:
            warnings.append(f"Failed setting {name}: {e}")

    def set_text(field: Optional[dict], name: str, value: str):
        if not field:
            warnings.append(f"Missing Project field: {name}")
            return
        try:
            set_text_field(project_id, item_id, field["id"], value)
        except Exception as e:
            warnings.append(f"Failed setting {name}: {e}")

    set_select(status_field, "Status", desired_status)
    set_select(severity_field, "Severity", desired_sev)
    set_select(track_field, "Track", desired_track)
    set_select(domain_field, "Domain", desired_domain)
    set_select(milestone_field, "Milestone", desired_milestone)

    set_text(cap_field, "CapabilityID", desired_cap)
    set_text(baseline_field, "Baseline", desired_baseline)

    return warnings


# -----------------------------
# Main
# -----------------------------

def main() -> int:
    ensure_gh_available()

    ap = argparse.ArgumentParser()
    ap.add_argument("--tech-debt", default="docs/TECH_DEBT.md", help="Path to TECH_DEBT.md")
    ap.add_argument("--repo", default="", help="Override repo as OWNER/REPO (optional)")
    ap.add_argument("--project-owner", default="", help="Org/user login that owns the Project v2 (optional)")
    ap.add_argument("--project-number", type=int, default=0, help="Project v2 number (optional)")
    ap.add_argument("--apply", action="store_true", help="Apply changes (create/update issues and project items)")
    ap.add_argument("--update-existing", action="store_true", help="Update body for existing issues")
    ap.add_argument("--limit", type=int, default=0, help="Limit number of items processed (0 = no limit)")
    ap.add_argument("--bootstrap-labels", action="store_true", help="Create/update required labels (recommended first run)")
    ap.add_argument("--project-status", default="Backlog", help="Project Status value to set (default Backlog)")
    args = ap.parse_args()

    items = parse_tech_debt(args.tech_debt)
    if not items:
        print("No OPEN items found in TECH_DEBT.")
        return 0

    if args.limit and args.limit > 0:
        items = items[: args.limit]

    repo = args.repo.strip() or detect_repo_name_with_owner()
    print(f"Repo: {repo}")
    print(f"Parsed OPEN items: {len(items)} (from {args.tech_debt})")
    print(f"Mode: {'APPLY' if args.apply else 'DRY-RUN'}")

    if args.apply and args.bootstrap_labels:
        print("Bootstrapping labels...")
        ensure_labels_exist(repo)

    use_project = bool(args.project_owner and args.project_number)
    project_id = ""
    fields_by_name: Dict[str, dict] = {}
    project_title = ""

    if use_project:
        try:
            project_id, fields_by_name, project_title = load_project(args.project_owner, args.project_number)
            print(f"Project loaded: {project_title} (owner={args.project_owner} number={args.project_number})")
        except Exception as e:
            print(f"WARNING: Could not load Project v2.\n{e}\nWill proceed with issues only.")
            use_project = False

    created = 0
    updated = 0
    project_linked = 0

    for it in items:
        issue_title = f"[{it.capability_id}] {it.title}"
        labels = labels_for_item(it)
        body = build_issue_body(it)

        existing = find_existing_issue_number(repo, it.capability_id)
        if existing:
            print(f"- EXISTS #{existing}: {issue_title}")

            if args.apply:
                update_issue(repo, existing, body if args.update_existing else None, labels)
                updated += 1

            if use_project:
                try:
                    issue_node_id = get_issue_node_id(repo, existing)
                    if args.apply:
                        item_id = ensure_project_item(project_id, issue_node_id)
                        warns = try_set_project_fields(project_id, fields_by_name, item_id, it, args.project_status)
                        for w in warns:
                            print(f"  WARN: {w}")
                        project_linked += 1
                        print("  Project: linked + fields set.")
                    else:
                        print("  (dry-run) Would link to Project + set fields.")
                except Exception as e:
                    print(f"  WARNING: Project link/set failed: {e}")
            continue

        print(f"- CREATE: {issue_title}")
        if not args.apply:
            print(f"  labels={labels}")
            continue

        number, url, node_id = create_issue(repo, issue_title, body, labels)
        created += 1
        print(f"  Created #{number} {url}")

        if use_project and node_id:
            try:
                item_id = ensure_project_item(project_id, node_id)
                warns = try_set_project_fields(project_id, fields_by_name, item_id, it, args.project_status)
                for w in warns:
                    print(f"  WARN: {w}")
                project_linked += 1
                print("  Project: linked + fields set.")
            except Exception as e:
                print(f"  WARNING: Project link/set failed: {e}")

    print(f"\nDone. Created={created} Updated={updated} ProjectLinked={project_linked} TotalProcessed={len(items)}")
    if not args.apply:
        print("Dry-run only. Re-run with --apply to make changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
