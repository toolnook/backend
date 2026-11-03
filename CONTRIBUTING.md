# Contributing to Streamline

Thanks for your interest in improving Streamline! This guide covers the development workflow.

## Getting started

```bash
git clone https://github.com/toolnook/backend.git
cd streamline
npm install
npm run build
npm test
```

## Development workflow

1. Create a branch for your change:
   ```bash
   git checkout -b fix/your-bug-or-feature
   ```

2. Make your changes. Follow the existing code style (TypeScript, strict mode).

3. Add or update tests. All new features and bug fixes should include test coverage. Run tests locally:
   ```bash
   npm test
   ```

4. Ensure the build passes:
   ```bash
   npm run build
   ```

5. Write clear, descriptive commit messages:
   ```
   Add retry logic to proxy timeout handler
   Fix race condition in rate limiter refill
   ```

6. Push and open a pull request against `main`.

## Code style

- TypeScript strict mode — no `any` unless absolutely necessary (and document why).
- Every public function should have a JSDoc comment.
- Keep modules focused — one responsibility per file.
- Prefer pure functions where possible; isolate side effects (I/O, timers).

## Testing guidelines

- Unit tests go in `tests/` and mirror the `src/` structure (e.g. `tests/config.test.ts` tests `src/config.ts`).
- Integration tests should create real servers where possible — mock sparingly.
- Test names should describe the behaviour, not the implementation: `"allows requests up to capacity"` not `"test allow"`.

## Reporting issues

- Use the bug report template for bugs.
- Use the feature request template for new features.
- Include the Streamline version, Node.js version, and a minimal config that reproduces the issue.

## Pull request checklist

- [ ] Tests pass (`npm test`)
- [ ] Build passes (`npm run build`)
- [ ] Commit messages are descriptive
- [ ] No `console.log` left in code (use the Logger)
- [ ] Documentation updated if behaviour changes
