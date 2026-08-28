/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);
const projectRoot = resolve(_dirname, '..');

// Keep `pnpm dev` isolated from the Docker/production configuration.
// An explicit MISSKEY_CONFIG_YML still takes precedence for custom setups.
process.env.MISSKEY_CONFIG_YML ??= 'dev.yml';

const localFrontendPackages = [
	['vune-ui', 'packages/modules/Vune'],
	['@vune-ui/compiler', 'packages/modules/Vune/packages/compiler'],
	['@vune-ui/core', 'packages/modules/Vune/packages/core'],
	['@vune-ui/vite', 'packages/modules/Vune/packages/vite'],
	['@vune-ui/vue', 'packages/modules/Vune/packages/vue'],
	['@vune-ui/web', 'packages/modules/Vune/packages/web'],
	['o0o0o', 'packages/modules/o0o0o'],
];

/**
 * Reassert the package.json local Vune/o0o0o links after rebuilding the
 * framework. This keeps dev startup deterministic even if an older install
 * left published-package symlinks behind.
 */
function linkLocalFrontendPackages() {
	const nodeModulesDir = resolve(projectRoot, 'packages/frontend/node_modules');

	for (const [packageName, relativeSource] of localFrontendPackages) {
		const source = resolve(projectRoot, relativeSource);
		const target = resolve(nodeModulesDir, packageName);
		linkLocalPackage(source, target);
	}
}

/**
 * Create a local package link while refusing to remove a real directory.
 *
 * @param {string} source - Absolute package source path.
 * @param {string} target - Absolute symlink path.
 */
function linkLocalPackage(source, target) {
	if (!existsSync(source)) {
		throw new Error(`Local package source does not exist: ${source}`);
	}

	mkdirSync(dirname(target), { recursive: true });
	try {
		if (!lstatSync(target).isSymbolicLink()) {
			throw new Error(`Refusing to replace non-symlink dependency: ${target}`);
		}
		rmSync(target);
	} catch (error) {
		if (error?.code !== 'ENOENT') throw error;
	}

	symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
}

/** @type {Set<import('execa').ResultPromise>} */
const childProcesses = new Set();
/** @type {Set<import('execa').ResultPromise>} */
const persistentChildProcesses = new Set();
let shuttingDown = false;
let persistentChildProcessesStarted = false;
let persistentChildProcessFailed = false;
/** @type {Promise<void> | null} */
let shutdownPromise = null;

/**
 * 開発用コマンドを起動し、終了時にまとめて停止できるよう追跡する。
 * Windows では Ctrl+C の配信先を分離し、出力を親コンソールへ中継する。
 *
 * @param {string} command - 実行するコマンド。
 * @param {string[]} args - コマンドへ渡す引数。
 * @param {import('execa').Options} options - execa の起動オプション。
 * @returns {import('execa').ResultPromise} 起動した子プロセス。
 */
function spawnChildProcess(command, args, options) {
	const isWindows = process.platform === 'win32';
	const shouldForceColor = (process.stdout.isTTY || process.stderr.isTTY)
		&& process.env.FORCE_COLOR == null
		&& process.env.NO_COLOR == null;
	const pnpmPath = _dirname + '/../node_modules/pnpm/bin/pnpm.mjs';
	const windowsCommand = [process.execPath, pnpmPath, ...args]
		.map(argument => `"${argument}"`)
		.join(' ');
	const executable = isWindows && command === 'pnpm' ? process.env.ComSpec ?? 'cmd.exe' : command;
	const executableArgs = isWindows && command === 'pnpm'
		? ['/d', '/s', '/c', `start "" /b /wait ${windowsCommand}`]
		: args;
	const childProcess = execa(executable, executableArgs, isWindows ? {
		...options,
		// `start /b` keeps the process in the current console without forwarding
		// Ctrl+C, allowing only this supervisor to coordinate the shutdown.
		windowsVerbatimArguments: true,
		windowsHide: false,
		env: shouldForceColor ? { FORCE_COLOR: '1' } : undefined,
		stdout: 'pipe',
		stderr: 'pipe',
		buffer: false,
	} : options);

	if (isWindows) {
		if (options.stdout != null) childProcess.stdout?.pipe(options.stdout, { end: false });
		if (options.stderr != null) childProcess.stderr?.pipe(options.stderr, { end: false });
	}

	childProcesses.add(childProcess);
	return childProcess;
}

/**
 * 子プロセスの終了を待機し、追跡対象から取り除く。
 *
 * @param {string} command - 実行するコマンド。
 * @param {string[]} args - コマンドへ渡す引数。
 * @param {import('execa').Options} options - execa の起動オプション。
 * @returns {Promise<import('execa').Result>} 子プロセスの実行結果。
 */
async function runChildProcess(command, args, options) {
	const childProcess = spawnChildProcess(command, args, options);

	try {
		return await childProcess;
	} finally {
		childProcesses.delete(childProcess);
	}
}

/**
 * 常駐する子プロセスがすべて終了していれば、終了結果を引き継いで親も終了する。
 *
 * @returns {void}
 */
function shutdownIfAllPersistentChildProcessesStopped() {
	if (shuttingDown || !persistentChildProcessesStarted || persistentChildProcesses.size > 0) return;

	void shutdown(persistentChildProcessFailed ? 1 : 0);
}

/**
 * 常駐する子プロセスを起動し、終了時の追跡解除・エラー出力・親の終了判定を設定する。
 *
 * @param {string} command - 実行するコマンド。
 * @param {string[]} args - コマンドへ渡す引数。
 * @param {import('execa').Options} options - execa の起動オプション。
 * @returns {void}
 */
function startChildProcess(command, args, options) {
	const childProcess = spawnChildProcess(command, args, options);
	persistentChildProcesses.add(childProcess);

	void childProcess.then(() => {
		childProcesses.delete(childProcess);
		persistentChildProcesses.delete(childProcess);
		shutdownIfAllPersistentChildProcessesStopped();
	}, error => {
		childProcesses.delete(childProcess);
		persistentChildProcesses.delete(childProcess);
		if (!shuttingDown) {
			persistentChildProcessFailed = true;
			console.error(error);
			shutdownIfAllPersistentChildProcessesStopped();
		}
	});
}

/**
 * 子プロセスとその配下のプロセスを停止し、終了を待機する。
 *
 * @param {import('execa').ResultPromise} childProcess - 停止する子プロセス。
 * @returns {Promise<void>}
 */
async function stopChildProcess(childProcess) {
	if (process.platform === 'win32' && childProcess.pid != null) {
		const result = await execa('taskkill', ['/pid', childProcess.pid.toString(), '/t', '/f'], {
			reject: false,
		});
		if (result.failed) childProcess.kill();
	} else {
		childProcess.kill();
	}

	await childProcess.catch(() => {});
}

/**
 * 追跡中の子プロセスを一度だけ停止して、指定した終了コードで終了する。
 *
 * @param {number} exitCode - 親プロセスに返す終了コード。
 * @returns {Promise<void>} 実行中または完了した停止処理。
 */
function shutdown(exitCode) {
	if (shutdownPromise != null) return shutdownPromise;

	shuttingDown = true;
	shutdownPromise = (async () => {
		await Promise.allSettled([...childProcesses].map(stopChildProcess));
		process.exit(exitCode);
	})();

	return shutdownPromise;
}

process.on('SIGINT', () => {
	void shutdown(0);
});

process.on('SIGTERM', () => {
	void shutdown(0);
});

try {
	await runChildProcess('pnpm', ['clean'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	// Build the checked-out motion runtime before the frontend starts. The
	// frontend package.json already points at local Vune/o0o0o packages; the
	// explicit link refresh below only repairs stale installs from older trees.
	await runChildProcess('pnpm', ['--dir', resolve(projectRoot, 'packages/modules/o0o0o'), 'run', 'build:wasm'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	// Match serve.sh exactly: link o0o0o into Vune's web package before Vune
	// builds, so the checked-out motion runtime is included in its output.
	linkLocalPackage(
		resolve(projectRoot, 'packages/modules/o0o0o'),
		resolve(projectRoot, 'packages/modules/Vune/packages/web/node_modules/o0o0o'),
	);

	await runChildProcess('pnpm', ['--dir', resolve(projectRoot, 'packages/modules/Vune'), 'run', 'build'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	linkLocalFrontendPackages();

	// アセットのビルドで依存しているので一番最初に必要
	await runChildProcess('pnpm', ['--filter', 'i18n', 'build'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	await Promise.all([
		runChildProcess('pnpm', ['build-pre'], {
			cwd: projectRoot,
			stdout: process.stdout,
			stderr: process.stderr,
		}),
		runChildProcess('pnpm', ['build-assets'], {
			cwd: projectRoot,
			stdout: process.stdout,
			stderr: process.stderr,
		}),
		runChildProcess('pnpm', ['--filter', 'backend...', '--filter=!backend', 'build'], {
			cwd: projectRoot,
			stdout: process.stdout,
			stderr: process.stderr,
		}),
		// icons-subsetterは開発段階では使用されないが、型エラーを抑制するためにはじめの一度だけビルドする
		runChildProcess('pnpm', ['--filter', 'icons-subsetter', 'build'], {
			cwd: projectRoot,
			stdout: process.stdout,
			stderr: process.stderr,
		}),
		runChildProcess('pnpm', ['--filter', 'misskey-js', 'build'], {
			cwd: projectRoot,
			stdout: process.stdout,
			stderr: process.stderr,
		}),
	]);

	startChildProcess('pnpm', ['build-pre', '--watch'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	startChildProcess('pnpm', ['build-assets', '--watch'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	startChildProcess('pnpm', ['--dir', resolve(projectRoot, 'packages/modules/Vune'), 'run', 'dev:watch', '--', '--no-build'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	startChildProcess('pnpm', ['--filter', 'backend', 'dev'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	startChildProcess('pnpm', ['--filter', 'frontend', 'watch'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	startChildProcess('pnpm', ['--filter', 'frontend-embed', 'watch'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	startChildProcess('pnpm', ['--filter', 'sw', 'watch'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	startChildProcess('pnpm', ['--filter', 'misskey-js', 'watch', '--no-clean'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	startChildProcess('pnpm', ['--filter', 'i18n', 'watch', '--no-clean'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	startChildProcess('pnpm', ['--filter', 'misskey-reversi', 'watch', '--no-clean'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	startChildProcess('pnpm', ['--filter', 'misskey-bubble-game', 'watch', '--no-clean'], {
		cwd: projectRoot,
		stdout: process.stdout,
		stderr: process.stderr,
	});

	persistentChildProcessesStarted = true;
	shutdownIfAllPersistentChildProcessesStopped();
} catch (error) {
	if (!shuttingDown) {
		console.error(error);
		await shutdown(1);
	}
}
