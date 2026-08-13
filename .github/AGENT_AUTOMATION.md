# Issue-to-PR automation contract

The FrontDoor website agent checks GitHub issues every 30 minutes and may work only on open issues carrying the `agent-ready` label.

## Success criteria

- At most one issue is implemented per run.
- An issue with an existing open pull request is never implemented twice.
- Every change is isolated on `agent/issue-<number>-<slug>` and submitted as a pull request with `Closes #<number>`.
- The agent runs static checks and `npm run deploy -- --dry-run` before opening a pull request.
- Every run reports its outcome to the FrontDoor website Discord thread, including no-op and blocked runs.
- Merging a reviewed pull request into `main` triggers the Cloudflare production deployment.

## Allowed scope

- Website source, assets, metadata, documentation, tests, and deployment configuration in this repository.
- Changes explicitly requested by the selected issue.

## Constraints and non-goals

- The agent must not approve or merge pull requests.
- The agent must not close issues directly; the pull request uses `Closes #<number>`.
- The agent must not purchase domains, change billing, disclose credentials, weaken security headers, or perform destructive operations.
- The agent must not work on issues without `agent-ready`.
- Ambiguous, contradictory, security-sensitive, or unverifiable requests are reported as blocked without source changes.
- Scope must not expand beyond the selected issue without human approval.

## Verification signals

Run the checks relevant to the change, with this baseline:

```bash
npm install
git diff --check
node --check public/script.js
xmllint --noout public/assets/frontdoor-icon.svg
npm run deploy -- --dry-run
```

For visual changes, the pull request must explain what changed and identify the affected viewport or component for human review.

## Blocked stop condition

Stop without opening a pull request when access is missing, the issue cannot be implemented safely, the result cannot be verified, or continuing would require a production-impacting action outside this contract. The thread report must state the issue number, evidence, blocker, risk, and exact input required.
