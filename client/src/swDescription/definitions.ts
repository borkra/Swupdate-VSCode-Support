// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 borkra
'use strict';

export const SW_DESCRIPTION_BOOLEAN_KEYS = [
	'bootloader_transaction_marker',
	'bootloader_state_marker',
	'reboot',
	'preserve-attributes',
	'installed-directly',
	'install-if-different',
	'install-if-higher'
] as const;

export const SW_DESCRIPTION_STRING_KEYS = [
	'update-type',
	'fstype',
	'aes-key',
	'ivt',
	'sha256',
	'hook',
	'ubipartition',
	'ref'
] as const;

export const SW_DESCRIPTION_COLON_VALUE_KEYS = [
	'hardware-compatibility',
	'ref'
] as const;

export const SW_DESCRIPTION_COMPRESSED_VALUES = [
	'zlib',
	'zstd',
	'xz',
	'lz4'
] as const;

export const SW_DESCRIPTION_ENCRYPTED_VALUES = [
	'aes-cbc'
] as const;

export const SW_DESCRIPTION_BOOLEAN_KEYWORD_VALUES = [
	'true',
	'false'
] as const;

// Values for the 'fstype' key - SWUpdate handler-specific filesystem types.
// Note: 'filesystem' (files section, device mount) accepts any Linux mount-supported
// type and is NOT validated against this list.
export const SW_DESCRIPTION_FILESYSTEM_VALUES = [
	'vfat',
	'ext2',
	'ext3',
	'ext4',
	'btrfs'
] as const;

export const SW_DESCRIPTION_DISKPART_LABELTYPE_VALUES = [
	'gpt',
	'dos'
] as const;

/**
 * All valid field keys inside a partition-N entry string (e.g. "size=64M", "name=kernel_a").
 * Source: SWUpdate handlers/diskpart_handler.c fields[] array.
 */
export const SW_DESCRIPTION_DISKPART_PARTITION_ENTRY_KEYS = new Set<string>([
	'size',
	'start',
	'type',
	'name',
	'fstype',
	'dostype',
	'partuuid',
	'flag',
	'force',
	'fslabel'
]);

// GPT partition type GUID, e.g. "0FC63DAF-8483-4772-8E79-3D69D8477DE4"
export const SW_DESCRIPTION_DISKPART_TYPE_GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// DOS/MBR partition type hex byte, e.g. "83" (Linux), "8e" (LVM)
export const SW_DESCRIPTION_DISKPART_TYPE_DOS_REGEX = /^[0-9a-fA-F]{1,2}$/;

export const SW_DESCRIPTION_UPDATE_TYPE_VALUES = [
	'application',
	'OS'
] as const;

/**
 * Accepted string values for properties parsed via strtobool() in SWUpdate.
 * Only exactly these four strings are recognised; mixed-case (e.g. "True") is not.
 */
export const SW_DESCRIPTION_STRTOBOOL_VALUES = [
	'true',
	'TRUE',
	'false',
	'FALSE'
] as const;

/**
 * All known handler property keys (inside `properties = { ... }` blocks) that are
 * parsed via strtobool() in SWUpdate handlers. Values must be one of
 * SW_DESCRIPTION_STRTOBOOL_VALUES - native libconfig booleans are not accepted.
 *
 * Sources:
 *   atomic-install, create-destination  - raw_handler.c
 *   create-destination                  - archive_handler.c, btrfs_handler.c,
 *                                         rdiff_handler.c, copy_handler.c
 *   mount                               - btrfs_handler.c
 *   nolock, noinuse                     - diskpart_handler.c
 *   oob, noecc                          - flash_handler.c
 *   force                               - diskformat_handler.c
 *   always-remove, auto-resize          - ubivol_handler.c
 *   recursive                           - copy_handler.c
 *   global-state                        - lua_scripthandler.c
 *   nooverride                          - boot_handler.c
 *   debug                               - ucfw_handler.c
 */
export const SW_DESCRIPTION_STRTOBOOL_KEYS = [
	'atomic-install',
	'always-remove',
	'auto-resize',
	'create-destination',
	'debug',
	'force',
	'global-state',
	'mount',
	'noecc',
	'noinuse',
	'nolock',
	'nooverride',
	'oob',
	'recursive'
] as const;

/**
 * Property keys (inside `properties = { ... }` blocks) that expect a plain
 * decimal number string.  K/M/G suffixes are NOT accepted here.
 * 'size' and 'offset' are excluded — they appear at both levels and have
 * dedicated validators that distinguish the two contexts.
 *
 * Sources:
 *   source-size  - raw_handler.c (ustrtoull)
 *   max-ranges   - flash_handler.c (strtoul)
 *   partition    - ubivol_handler.c (strtoul — UBI partition number)
 *   timeout      - ucfw_handler.c (strtoul — seconds)
 */
export const SW_DESCRIPTION_NUMERIC_PROPERTY_KEYS = [
	'max-ranges',
	'offset',
	'partition',
	'size',
	'source-size',
	'timeout'
] as const;

/**
 * Size-valued property keys (inside `properties = { ... }` blocks) parsed via
 * ustrtoull(), so an optional K/M/G suffix is accepted (unlike the plain-decimal
 * keys above).
 *
 * Sources:
 *   decompressed-size  - core/util.c (compressed images)
 *   decrypted-size     - core/util.c (encrypted images)
 */
export const SW_DESCRIPTION_SIZE_PROPERTY_KEYS = [
	'decompressed-size',
	'decrypted-size'
] as const;

/**
 * Allowed values for the 'type' key inside a copy-handler `properties = { ... }`
 * block. SWUpdate's copy_handler.c restricts it to exactly these two (it selects
 * whether the copy runs as a pre- or post-install step).
 */
export const SW_DESCRIPTION_PROPERTY_TYPE_VALUES = [
	'preinstall',
	'postinstall'
] as const;

/**
 * Allowed values for the delta handler's 'zckloglevel' property (delta_handler.c).
 */
export const SW_DESCRIPTION_ZCKLOGLEVEL_VALUES = [
	'debug',
	'info',
	'warn',
	'error',
	'none'
] as const;

/**
 * Free-form string handler property keys (device names, commands, filenames,
 * labels, Lua function names, UUIDs, URLs, …). Recognised so they are not flagged
 * as unknown; their content is otherwise handler-specific and not validated here.
 *
 * Sources:
 *   btrfs-cmd, command          - btrfs_handler.c, shell handlers
 *   cmd                         - swuforward / generic command handlers
 *   copyfrom                    - copy_handler.c (source device / mtd:NAME)
 *   chain                       - copy_handler.c, delta_handler.c (chained handler)
 *   debug-chunks                - delta_handler.c (presence enables)
 *   fs-uuid                     - diskpart_handler.c (partition UUID list)
 *   fslabel                     - diskformat_handler.c / diskpart_handler.c
 *   name                        - docker_handler.c (container/image name)
 *   parms                       - swuforward_handler.c (forwarded parameters)
 *   parser-function             - delta_handler.c (Lua answer parser)
 *   path                        - btrfs_handler.c (subvolume path)
 *   rdiffbase                   - rdiff_handler.c (base file)
 *   replaces                    - ubivol_handler.c (volume to replace)
 *   source                      - delta_handler.c (source device)
 *   url                         - delta_handler.c / download handler
 *   zckfile                     - delta_handler.c (zchunk header file)
 */
export const SW_DESCRIPTION_STRING_PROPERTY_KEYS = [
	'btrfs-cmd',
	'chain',
	'cmd',
	'command',
	'copyfrom',
	'debug-chunks',
	'fs-uuid',
	'fslabel',
	'name',
	'parms',
	'parser-function',
	'path',
	'rdiffbase',
	'replaces',
	'source',
	'url',
	'zckfile'
] as const;

export const SW_DESCRIPTION_IMAGE_TYPE_VALUES = [
	'ubivol',
	'flash',
	'bootloader',
	'fpga',
	'raw'
] as const;

export const SW_DESCRIPTION_FILE_TYPE_VALUES = [
	'archive',
	'rawfile'
] as const;

export const SW_DESCRIPTION_PARTITION_TYPE_VALUES = [
	'diskpart',
	'diskformat',
	'toggleboot',
	'uniqueuuid',
	'ubipartition',
	'btrfs'
] as const;

export const SW_DESCRIPTION_SCRIPT_TYPE_VALUES = [
	'lua',
	'shellscript',
	'copy',
	'readback',
	'emmc_boot',
	'emmc_boot_toggle',
	'preinstall',
	'postinstall',
	'ssblswitch',
	'ubiswap',
	'docker_imagedelete',
	'docker_imageprune',
	'docker_containercreate',
	'docker_containerdelete',
	'docker_containerstart',
	'docker_containerstop'
] as const;

export type SwDescriptionTypeSection = 'images' | 'files' | 'partitions' | 'scripts';

export const SW_DESCRIPTION_TYPE_VALUES_BY_SECTION: Readonly<Record<SwDescriptionTypeSection, readonly string[]>> = {
	images: SW_DESCRIPTION_IMAGE_TYPE_VALUES,
	files: SW_DESCRIPTION_FILE_TYPE_VALUES,
	partitions: SW_DESCRIPTION_PARTITION_TYPE_VALUES,
	scripts: SW_DESCRIPTION_SCRIPT_TYPE_VALUES
} as const;

export const SW_DESCRIPTION_TYPE_VALUE_SETS_BY_SECTION =
	Object.fromEntries(
		(Object.entries(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION) as [SwDescriptionTypeSection, readonly string[]][]).map(
			([k, v]) => [k, new Set<string>(v)]
		)
	) as unknown as Readonly<Record<SwDescriptionTypeSection, ReadonlySet<string>>>;

export const SW_DESCRIPTION_GENERAL_LITERAL_VALUES = [
	...SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.images.filter(v => ['flash', 'bootloader', 'raw'].includes(v)),
	...SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.scripts.filter(v => ['lua', 'shellscript', 'preinstall', 'postinstall'].includes(v)),
	...SW_DESCRIPTION_COMPRESSED_VALUES,
	...SW_DESCRIPTION_ENCRYPTED_VALUES,
	...SW_DESCRIPTION_UPDATE_TYPE_VALUES
];

export type SwDescriptionStatementTemplate = {
	label: string;
	kind: 'field' | 'snippet';
	insertText: string;
	detail: string;
};

export const SW_DESCRIPTION_STATEMENT_TEMPLATES: readonly SwDescriptionStatementTemplate[] = [
	{
		label: 'software',
		kind: 'snippet',
		insertText: 'software = {\n\t$1\n};',
		detail: 'SWUpdate root software block'
	},
	{
		label: 'version',
		kind: 'field',
		insertText: 'version = "${1:0.1.0}";',
		detail: 'SWUpdate release version'
	},
	{
		label: 'description',
		kind: 'field',
		insertText: 'description = "${1:Firmware update}";',
		detail: 'SWUpdate release description'
	},
	{
		label: 'update-type',
		kind: 'field',
		insertText: 'update-type = "${1:application}";',
		detail: 'SWU classification used to select per-type policy in swupdate.cfg'
	},
	{
		label: 'embedded-script',
		kind: 'field',
		insertText: 'embedded-script = "${1:function hook(image)\\n\\treturn true, image\\nend}";',
		detail: 'Embedded Lua script for entry mutation'
	},
	{
		label: 'hardware-compatibility',
		kind: 'field',
		insertText: 'hardware-compatibility: [ "${1:1.0}" ];',
		detail: 'Compatible hardware revisions'
	},
	{
		label: 'images',
		kind: 'snippet',
		insertText: 'images: (\n\t\t{\n\t\t\tfilename = "${1:image.ext4}";\n\t\t\tdevice = "${2:/dev/mmcblk0p1}";\n\t\t}\n\t);',
		detail: 'Image artifacts to install'
	},
	{
		label: 'files',
		kind: 'snippet',
		insertText: 'files: (\n\t\t{\n\t\t\tfilename = "${1:file}";\n\t\t\tpath = "${2:/path/in/rootfs}";\n\t\t}\n\t);',
		detail: 'Single file installation entries'
	},
	{
		label: 'scripts',
		kind: 'snippet',
		insertText: 'scripts: (\n\t\t{\n\t\t\tfilename = "${1:script.lua}";\n\t\t\ttype = "${2:lua}";\n\t\t}\n\t);',
		detail: 'Pre/Post install scripts'
	},
	{
		label: 'partitions',
		kind: 'snippet',
		insertText: 'partitions: (\n\t\t{\n\t\t\tname = "${1:rootfs}";\n\t\t\tdevice = "${2:mtd4}";\n\t\t\tsize = ${3:104857600};\n\t\t}\n\t);',
		detail: 'UBI volume layout'
	},
	{
		label: 'bootenv',
		kind: 'snippet',
		insertText: 'bootenv: (\n\t\t{\n\t\t\tname = "${1:bootpart}";\n\t\t\tvalue = "${2:0:2}";\n\t\t}\n\t);',
		detail: 'Bootloader environment update entries'
	},
	{
		label: 'vars',
		kind: 'snippet',
		insertText: 'vars: (\n\t\t{\n\t\t\tname = "${1:key}";\n\t\t\tvalue = "${2:value}";\n\t\t}\n\t);',
		detail: 'Persistent SWUpdate variables'
	},
	{
		label: 'reboot',
		kind: 'field',
		insertText: 'reboot = ${1:false};',
		detail: 'Signal if reboot is required'
	},
	{
		label: 'bootloader_transaction_marker',
		kind: 'field',
		insertText: 'bootloader_transaction_marker = ${1:true};',
		detail: 'Enable/disable recovery status marker'
	},
	{
		label: 'bootloader_state_marker',
		kind: 'field',
		insertText: 'bootloader_state_marker = ${1:true};',
		detail: 'Enable/disable bootloader state marker'
	},
	{
		label: 'properties',
		kind: 'snippet',
		insertText: 'properties = {\n\t\tcreate-destination = "${1:true}";\n\t\tatomic-install = "${2:true}";\n\t};',
		detail: 'Additional handler properties'
	},
	{
		label: 'preserve-attributes',
		kind: 'field',
		insertText: 'preserve-attributes = ${1:true};',
		detail: 'Preserve archive metadata while unpacking files'
	},
	{
		label: 'ubipartition',
		kind: 'field',
		insertText: 'ubipartition = "${1:ubi0}";',
		detail: 'UBI partition containing the target volume'
	},
	{
		label: 'installed-directly',
		kind: 'field',
		insertText: 'installed-directly = ${1:true};',
		detail: 'Stream directly to target without temporary copy'
	},
	{
		label: 'install-if-different',
		kind: 'field',
		insertText: 'install-if-different = ${1:true};',
		detail: 'Install only when version differs from installed component'
	},
	{
		label: 'install-if-higher',
		kind: 'field',
		insertText: 'install-if-higher = ${1:true};',
		detail: 'Install only when version is higher than installed component'
	},
	{
		label: 'encrypted',
		kind: 'field',
		insertText: 'encrypted = "${1:aes-cbc}";',
		detail: 'Encrypted artifact cipher (bool form is also accepted)'
	},
	{
		label: 'aes-key',
		kind: 'field',
		insertText: 'aes-key = "${1:00112233445566778899aabbccddeeff}";',
		detail: 'AES key for encrypted artifacts (when allowed by setup)'
	},
	{
		label: 'ivt',
		kind: 'field',
		insertText: 'ivt = "${1:0123456789abcdef0123456789abcdef}";',
		detail: 'Initialization vector token for encrypted artifact'
	},
	{
		label: 'data',
		kind: 'field',
		insertText: 'data = "${1:arg1 arg2}";',
		detail: 'Arbitrary handler/script argument data'
	},
	{
		label: 'sha256',
		kind: 'field',
		insertText: 'sha256 = "${1:hash}";',
		detail: 'SHA-256 hash of the artifact'
	},
	{
		label: 'hook',
		kind: 'field',
		insertText: 'hook = "${1:set_version}";',
		detail: 'Embedded Lua function called while parsing this entry'
	},
	{
		label: 'size',
		kind: 'field',
		insertText: 'size = ${1:0};',
		detail: 'Artifact size in bytes or string with K/M/G suffix'
	},
	{
		label: 'ref',
		kind: 'field',
		insertText: 'ref = "${1:#./path}";',
		detail: 'Reference another node in sw-description'
	},
	{
		label: 'filename',
		kind: 'field',
		insertText: 'filename = "${1:image.bin}";',
		detail: 'Filename as found in the CPIO archive (mandatory for images, files, scripts)'
	},
	{
		label: 'volume',
		kind: 'field',
		insertText: 'volume = "${1:rootfs}";',
		detail: 'UBI volume name where image must be installed (type = "ubivol")'
	},
	{
		label: 'device',
		kind: 'field',
		insertText: 'device = "${1:/dev/mmcblk0p1}";',
		detail: 'Target device node (absolute path or name in /dev)'
	},
	{
		label: 'path',
		kind: 'field',
		insertText: 'path = "${1:/etc/config}";',
		detail: 'Destination path in filesystem (mandatory for files section)'
	},
	{
		label: 'filesystem',
		kind: 'field',
		insertText: 'filesystem = "${1:ext4}";',
		detail: 'Filesystem type used to mount device before copying file'
	},
	{
		label: 'mtdname',
		kind: 'field',
		insertText: 'mtdname = "${1:kernel}";',
		detail: 'MTD device name for the flash handler (alternative to device)'
	},
	{
		label: 'name',
		kind: 'field',
		insertText: 'name = "${1:component}";',
		detail: 'Name of the sw-component matched against /etc/sw-versions'
	},
	{
		label: 'value',
		kind: 'field',
		insertText: 'value = "${1:val}";',
		detail: 'Value to assign to a bootenv variable or persistent variable'
	}
] as const;

const SW_DESCRIPTION_ENTRY_IDENTITY_KEYS = [
	'filename',
	'name',
	'version',
	'description',
	'value'
] as const;

const SW_DESCRIPTION_ENTRY_TARGET_KEYS = [
	'volume',
	'device',
	'mtdname',
	'path',
	'filesystem'
] as const;

// Keys with additional, key-specific behavior beyond plain string/boolean typing.
const SW_DESCRIPTION_ENTRY_SPECIAL_MEANING_KEYS = [
	'type',
	'compressed',
	'encrypted',
	'offset',
	'size',
	'data',
	'embedded-script',
	'properties'
] as const;

export const SW_DESCRIPTION_ENTRY_KEY_GROUPS = {
	identity: SW_DESCRIPTION_ENTRY_IDENTITY_KEYS,
	target: SW_DESCRIPTION_ENTRY_TARGET_KEYS,
	specialMeaning: SW_DESCRIPTION_ENTRY_SPECIAL_MEANING_KEYS
} as const;

/**
 * All spec-defined property keys that may appear at the entry level inside
 * images / files / scripts / partitions list items. Anything outside this set
 * (and not matching partition-\d+) is a candidate typo.
 */
export const SW_DESCRIPTION_ENTRY_KNOWN_KEYS = new Set<string>([
	...SW_DESCRIPTION_BOOLEAN_KEYS,
	...SW_DESCRIPTION_STRING_KEYS,
	...SW_DESCRIPTION_ENTRY_KEY_GROUPS.identity,
	...SW_DESCRIPTION_ENTRY_KEY_GROUPS.target,
	...SW_DESCRIPTION_ENTRY_KEY_GROUPS.specialMeaning
]);

export const SW_DESCRIPTION_HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;
// Generic function call pattern: $function_name(...)
export const SW_DESCRIPTION_FUNCTION_REGEX = /^\$[a-zA-Z_][a-zA-Z0-9_]*\([^\)]*\)$/;
// Known SWUpdate helper functions accepted in string-value contexts.
export const SW_DESCRIPTION_KNOWN_HELPER_FUNCTION_REGEX = /^\$(swupdate_get_sha256|swupdate_get_size)\([^\)]+\)$/;
// Size/offset with optional K, M, G suffixes (for top-level use)
export const SW_DESCRIPTION_SIZE_REGEX = /^\d+(K|M|G)?$/;
export const SW_DESCRIPTION_OFFSET_REGEX = SW_DESCRIPTION_SIZE_REGEX;
// Size/offset as plain scalar only (no suffixes - for use inside properties blocks)
export const SW_DESCRIPTION_SIZE_SCALAR_REGEX = /^\d+$/;
export const SW_DESCRIPTION_OFFSET_SCALAR_REGEX = SW_DESCRIPTION_SIZE_SCALAR_REGEX;
export const SW_DESCRIPTION_IVT_REGEX = /^[0-9a-fA-F]{32}$/;
export const SW_DESCRIPTION_AES_KEY_REGEX = /^[0-9a-fA-F]{32}(?:[0-9a-fA-F]{16}){0,2}$/;
export const SW_DESCRIPTION_EXTERNAL_VARIABLE_REGEX = /^@@[^@]+@@$/;

const SW_DESCRIPTION_TYPE_SECTION_NAMES = new Set<string>(
	Object.keys(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION)
);
export function isSwDescriptionTypeSection(section: string | null): section is SwDescriptionTypeSection {
	return section !== null && SW_DESCRIPTION_TYPE_SECTION_NAMES.has(section);
}

export function isSwDescriptionDocumentUri(uri: string): boolean {
	const normalizedUri = decodeURIComponent(uri).split('?')[0].split('#')[0];
	const separatorIndex = Math.max(normalizedUri.lastIndexOf('/'), normalizedUri.lastIndexOf('\\'));
	const fileName = (separatorIndex === -1 ? normalizedUri : normalizedUri.slice(separatorIndex + 1)).toLowerCase();
	return fileName.startsWith('sw-description');
}