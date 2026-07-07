'use strict';

module.exports = {
    branches: ['main'],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        '@semantic-release/changelog',
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
        [
            '@semantic-release/git',
            {
                assets: ['package.json', 'package-lock.json', 'CHANGELOG.md'],
                message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
            },
        ],
        // Default failure-reporting tries to label the issue it opens
        // with "semantic-release", a label that doesn't exist in this
        // repo, which 422s and masks whatever the real failure was.
        ['@semantic-release/github', { labels: false }],
    ],
};
