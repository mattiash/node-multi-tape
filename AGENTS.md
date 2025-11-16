# Agent Steering Rules

## Changelog Maintenance

When making changes to the codebase, always update the `CHANGELOG.md` file to reflect the modifications:

- Add new entries under the `## [Unreleased]` section
- Follow the [Keep a Changelog](http://keepachangelog.com/en/1.0.0/) format
- Use these categories as appropriate:
    - `### Features` - for new features
    - `### Fixes` - for bug fixes
    - `### Breaking Changes` - for breaking API changes
    - `### Deprecated` - for soon-to-be removed features
    - `### Removed` - for removed features
    - `### Security` - for security fixes
- Use bullet points starting with `-` for each change
- Keep descriptions concise but clear
- When a version is released, the maintainer will move unreleased items to a dated version section

Example entry:

```markdown
## [Unreleased]

### Features

- Add new --parallel option for concurrent test execution

### Fixes

- Fix race condition in test output handling
```

## Making a release

To make a new release, perform the following steps:

1.  Update the package version in package.json
2.  Run npm install to automatically update package-lock.json
3.  Update Changelog.md with the new version
4.  Commit the above changes
5.  Run `./check-publish` and make sure that it succeeds
6.  push master
7.  Create a git tag in the format `v1.2.3`
8.  Push the tag
