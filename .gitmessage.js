const prompts = require('prompts');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gitArgs = process.argv.slice(2);

const hasExplicitMessage = gitArgs.some(
	arg =>
		arg === '-m' ||
		arg === '--message' ||
		arg === '-F' ||
		arg === '--file' ||
		arg.startsWith('--message=') ||
		arg.startsWith('--file=')
);

const commit = args => {
	execFileSync('git', ['commit', ...args], { stdio: 'inherit' });
};

(async () => {
	try {
		// A message was already provided — don't prompt, and don't open an editor.
		if (hasExplicitMessage) {
			commit(gitArgs);
			return;
		}

		const args = gitArgs;
		const hookMode = args[0] === '--hook';
		const hookFile = hookMode ? args[1] : null;
		const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
			encoding: 'utf8',
		}).trim();
		process.chdir(root);

		console.log('Starting commit message prompts...');

		const onCancel = () => {
			console.log('\nCommit cancelled by user');
			process.exit(1);
		};

		const response = await prompts(
			[
				{
					type: 'text',
					name: 'description',
					message: 'Enter a description of your changes:',
					validate: value => value.length >= 10 || 'Description must be at least 10 characters',
				},
				{
					type: 'select',
					name: 'type',
					message: 'Select the type of change:',
					choices: [
						{
							title: 'Bug fix (non-breaking change which fixes an issue)',
							value: 'bug',
						},
						{
							title: 'New feature (non-breaking change which adds functionality)',
							value: 'feature',
						},
						{ title: 'Breaking change', value: 'breaking' },
						{ title: 'Documentation update', value: 'docs' },
						{ title: 'Code refactor', value: 'refactor' },
						{ title: 'Performance improvement', value: 'perf' },
						{ title: 'Dependencies update', value: 'deps' },
					],
				},
				{
					type: 'confirm',
					name: 'buildCheck',
					message: 'Would you like to verify the build before committing?',
					initial: true,
				},
				{
					type: 'text',
					name: 'notes',
					message: 'Additional notes (optional):',
				},
			],
			{
				onCancel,
			}
		);

		if (!response.description || !response.type) {
			console.error('Commit cancelled: Required fields missing');
			process.exit(1);
		}

		if (response.buildCheck) {
			console.log('\nRunning build check...');
			try {
				execFileSync('bun', ['run', 'build'], { stdio: 'inherit' });
				console.log('✅ Build successful!');
			} catch {
				console.error('\n❌ Build failed. Please fix errors before committing.');
				process.exit(1);
			}
		}

		const typeEmoji = {
			bug: '🐛',
			feature: '✨',
			breaking: '💥',
			docs: '📚',
			refactor: '♻️',
			perf: '⚡',
			deps: '📦',
		};

		const commitMessage =
			`${typeEmoji[response.type]} ${response.description}\n\n` +
			`Type: ${response.type}\n` +
			`Build: ${response.buildCheck ? '✅ Verified' : '⏩ Skipped'}\n` +
			(response.notes ? `\nNotes: ${response.notes}` : '');

		// Called by .husky/prepare-commit-msg — write the message and let that commit finish.
		if (hookMode) {
			fs.writeFileSync(hookFile, commitMessage);
			return;
		}
		const msgFile = path.join(os.tmpdir(), `tackl-commit-${process.pid}.txt`);
		fs.writeFileSync(msgFile, commitMessage);

		try {
			commit(['-F', msgFile, ...gitArgs]);
		} finally {
			fs.rmSync(msgFile, { force: true });
		}
	} catch (err) {
		const status = err && typeof err === 'object' && 'status' in err ? err.status : null;
		if (typeof status === 'number' && status !== 0) process.exit(status);
		console.error('Error during commit:', err);
		process.exit(1);
	}
})();
