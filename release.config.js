'use strict';

module.exports = {
    branches: ['main'],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        // Nothing commits CHANGELOG.md now that @semantic-release/git is
        // gone, so the notes live in the GitHub release, which is where
        // release-notes-generator already puts them.
        // @semantic-release/npm's own OIDC verification 404s against the
        // npm registry's token-exchange endpoint (confirmed on a live
        // run here) even though the plain `npm publish` CLI already
        // authenticates correctly via OIDC when run in GitHub Actions
        // with id-token: write - the same mechanism the workflow this
        // replaced used successfully. So: let this plugin only bump
        // package.json's version (npmPublish: false), and do the actual
        // publish via @semantic-release/exec's publishCmd below, calling
        // the CLI directly instead of going through this plugin's
        // broken auth path.
        ['@semantic-release/npm', { npmPublish: false }],
        ['@semantic-release/exec', { publishCmd: 'npm publish' }],
        // @semantic-release/git is deliberately absent. It committed the
        // version bump and changelog back to main, and main requires the
        // "test" status check, which a direct push can never satisfy:
        //
        //   remote: error: GH006: Protected branch update failed
        //   remote: - Required status check "test" is expected.
        //
        // That failure was worse than it looked. Plugins run grouped by
        // step rather than in list order, so every prepare finishes
        // before any publish starts: the rejected push killed the run
        // before publishCmd above was reached, and nothing published at
        // all.
        //
        // Nothing needs that commit. The git tag, the GitHub release and
        // the published package all carry the version; only
        // package.json on main goes stale, which is the ordinary shape
        // of a tag-driven release. The alternative was a protection
        // bypass so a bot could write to main, which costs more than a
        // stale version field.
        // Default failure-reporting tries to label the issue it opens
        // with "semantic-release", a label that doesn't exist in this
        // repo, which 422s and masks whatever the real failure was.
        ['@semantic-release/github', { labels: false }],
    ],
};
