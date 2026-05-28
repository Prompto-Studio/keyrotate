# keyrotate-win32-x64

This is the **Windows x64** prebuilt binary for [`keyrotate`](https://www.npmjs.com/package/keyrotate) — a one-command API-key rotator that updates 1Password, GitHub Actions secrets, Supabase Edge Function secrets, Netlify env vars, Fly.io app secrets, and `.env` files in a single command, verifying the new key against the upstream provider before writing.

## Do not install this package directly

This package only contains a platform-specific binary. Install the main `keyrotate` package instead — npm will automatically pick the right binary for your operating system via [`optionalDependencies`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#optionaldependencies):

```bash
npm install -g keyrotate
# or
npx keyrotate setup
```

## What this binary does

The compiled binary in `bin/keyrotate.exe` is produced by [Bun's standalone compiler](https://bun.sh/docs/bundler/executables) from the keyrotate TypeScript source. It runs on 64-bit Windows 10 and Windows 11 and does not require Node.js or Bun to be installed at runtime — everything is statically linked into a single executable.

See the main package for full documentation, source code, and license.

- Repository: https://github.com/Prompto-Studio/keyrotate
- Main package: https://www.npmjs.com/package/keyrotate
- Docs: https://github.com/Prompto-Studio/keyrotate#readme

## License

MIT — see [LICENSE](https://github.com/Prompto-Studio/keyrotate/blob/main/LICENSE).
