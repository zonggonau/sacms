# SaCMS — Project Guide & Deployment Configuration

## Deploy Configuration (configured by /setup-deploy)
- Platform: VPS (Docker Compose + PostgreSQL 17 + Redis 7 + Caddy)
- Production URL: https://sacms.cloud
- Deploy workflow: .github/workflows/ci.yml
- Deploy trigger: Automatic on push to `master`, `develop`, `aisacms`
- Deploy status command: curl -sf https://sacms.cloud/api/health
- Post-deploy health check: https://sacms.cloud/api/health
- Server Host: 164.68.116.79
- App Target Directory: /opt/sacms
- Merge method: squash

### Custom deploy hooks
- Pre-merge: `bun run lint && bun run test && bun run build`
- Deploy trigger: Automatic via GitHub Actions CI/CD on git push
- Post-deploy verification: `curl -sf https://sacms.cloud/api/health`

---

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
- Configure deploy settings → invoke /setup-deploy
