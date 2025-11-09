# Agent Steering Rules

## Changelog Maintenance

When making changes to the codebase, always update the `Changelog.md` file to reflect the modifications:

-   Add new entries under the `## [Unreleased]` section
-   Follow the [Keep a Changelog](http://keepachangelog.com/en/1.0.0/) format
-   Use these categories as appropriate:
    -   `### Features` - for new features
    -   `### Fixes` - for bug fixes
    -   `### Breaking Changes` - for breaking API changes
    -   `### Deprecated` - for soon-to-be removed features
    -   `### Removed` - for removed features
    -   `### Security` - for security fixes
-   Use bullet points starting with `-` for each change
-   Keep descriptions concise but clear
-   When a version is released, the maintainer will move unreleased items to a dated version section

Example entry:

```markdown
## [Unreleased]

### Features

-   Add new --parallel option for concurrent test execution

### Fixes

-   Fix race condition in test output handling
```
