import { extname } from 'node:path';
import type { BuildOptions, Rollup, Plugin as VitePlugin } from 'vite';

// eslint-disable-next-line @typescript-eslint/ban-types
type OutputOptionsHook = Extract<VitePlugin['outputOptions'], Function>;
type OutputOptions = Parameters<OutputOptionsHook>[0];

type ExtendManualChunksHooks = {
	before?: Rollup.GetManualChunk;
	after?: Rollup.GetManualChunk;
};

export function extendManualChunks(outputOptions: OutputOptions, hooks: ExtendManualChunksHooks) {
	const manualChunks = outputOptions.manualChunks;
	outputOptions.manualChunks = function (id, meta) {
		if (hooks.before) {
			let value = hooks.before(id, meta);
			if (value) {
				return value;
			}
		}

		// Defer to user-provided `manualChunks`, if it was provided.
		if (typeof manualChunks == 'object') {
			if (id in manualChunks) {
				let value = manualChunks[id];
				return value[0];
			}
		} else if (typeof manualChunks === 'function') {
			const outid = manualChunks.call(this, id, meta);
			if (outid) {
				return outid;
			}
		}

		if (hooks.after) {
			return hooks.after(id, meta) || null;
		}
		return null;
	};
}

// This is an arbitrary string that we are going to replace the dot of the extension
export const ASTRO_PAGE_EXTENSION_POST_PATTERN = '@_@';

/**
 * 1. We add a fixed prefix, which is used as virtual module naming convention;
 * 2. We replace the dot that belongs extension with an arbitrary string.
 *
 * @param virtualModulePrefix
 * @param path
 */
export function getVirtualModulePageNameFromPath(virtualModulePrefix: string, path: string) {
	// we mask the extension, so this virtual file
	// so rollup won't trigger other plugins in the process
	const extension = extname(path);
	return `${virtualModulePrefix}${path.replace(
		extension,
		extension.replace('.', ASTRO_PAGE_EXTENSION_POST_PATTERN)
	)}`;
}

/**
 *
 * @param virtualModulePrefix
 * @param id
 */
export function getPathFromVirtualModulePageName(virtualModulePrefix: string, id: string) {
	const pageName = id.slice(virtualModulePrefix.length);
	return pageName.replace(ASTRO_PAGE_EXTENSION_POST_PATTERN, '.');
}

export function shouldInlineAsset(
	assetContent: string,
	assetPath: string,
	assetsInlineLimit: NonNullable<BuildOptions['assetsInlineLimit']>
) {
	if (typeof assetsInlineLimit === 'number') {
		return Buffer.byteLength(assetContent) < assetsInlineLimit;
	}

	const result = assetsInlineLimit(assetPath, Buffer.from(assetContent));
	if (result != null) {
		return result;
	}

	return Buffer.byteLength(assetContent) < 4096; // Fallback to 4096kb by default (same as Vite)
}
