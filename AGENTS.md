# Project rules
- The source of truth is docs/PRD.md. If something is not specified there, STOP and ask; do not invent endpoints, fields, packages, or behavior.
- Work in phases (S0, S1, ...). Do only the phase I name. Do not start later phases or add extras.
- Only use the libraries listed in the PRD tech stack. Do not add a dependency without asking. Do NOT add cors, helmet, TanStack Query, Redux, React Hook Form, Zod, Next.js, or Docker.
- Install the latest stable versions and show me the versions in package.json.
- Before using any library API you are not 100% sure about, read its installed docs/types in node_modules or the official docs. Do not guess method names or options.
- Dates are YYYY-MM-DD strings. Never use timestamps for habit/completion days.
- Every habit/completion query must filter by the authenticated userId. Return 404, never 403.
- The access token lives only in client memory and is sent as a Bearer header. The refresh token lives only in the httpOnly cookie. Never use localStorage for tokens.
- All errors use the standard error shape. Never leak stack traces.
- Never hardcode secrets. Read config from env via config/env.ts.
- Frontend: all HTTP goes through src/api/ (axios); extract a component into src/components/ only when markup is used in more than one place; do not create wrapper components for plain buttons, inputs, or labels.
- After each phase: run the build, run the tests, and paste the real command output. Never claim something works unless you ran it.
- Write tests for the phase's business rules in the same phase, in the tests/ folder (committed to git).
- Keep files small; follow the folder structure in the PRD. No dead code, no placeholder TODO logic presented as complete.
- At the end of each phase, list: files created/changed, commands run with results, anything that deviates from the PRD.

# Git workflow
- Never commit, push, merge, or rebase on `main`. Never run `git push origin main` or `git checkout main` followed by changes.
- Before starting any phase, make sure you are on a working branch named `work/<phase>` (e.g. `work/s3-auth`), created from `staging`. If you are on `main`, stop and switch.
- Commit small and often on the working branch with clear messages (e.g. `S3: add refresh token rotation`).
- When a phase is done and its tests pass, merge the working branch into `staging` (`git checkout staging && git merge --no-ff work/<phase>`), then switch back to a new working branch for the next phase.
- Never force-push (`--force`) and never delete `main` or `staging`.
- Do not run any git command that rewrites history without asking me first.
- Before every merge, run the tests and paste the output. If tests fail, do not merge.