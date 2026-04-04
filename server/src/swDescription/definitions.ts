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
	'xz'
] as const;

export const SW_DESCRIPTION_ENCRYPTED_VALUES = [
	'aes-cbc'
] as const;

// Values for the 'fstype' key — SWUpdate handler-specific filesystem types.
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
 * SW_DESCRIPTION_STRTOBOOL_VALUES — native libconfig booleans are not accepted.
 *
 * Sources:
 *   atomic-install, create-destination  — raw_handler.c
 *   create-destination                  — archive_handler.c, btrfs_handler.c,
 *                                         rdiff_handler.c, copy_handler.c
 *   mount                               — btrfs_handler.c
 *   nolock, noinuse                     — diskpart_handler.c
 *   oob, noecc                          — flash_handler.c
 *   force                               — diskformat_handler.c
 *   always-remove, auto-resize          — ubivol_handler.c
 *   recursive                           — copy_handler.c
 */
export const SW_DESCRIPTION_STRTOBOOL_KEYS = [
	'atomic-install',
	'create-destination',
	'mount',
	'nolock',
	'noinuse',
	'oob',
	'noecc',
	'force',
	'always-remove',
	'auto-resize',
	'recursive'
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

export const SW_DESCRIPTION_TYPE_VALUE_SETS_BY_SECTION: Readonly<Record<SwDescriptionTypeSection, ReadonlySet<string>>> = {
	images: new Set<string>(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.images),
	files: new Set<string>(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.files),
	partitions: new Set<string>(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.partitions),
	scripts: new Set<string>(SW_DESCRIPTION_TYPE_VALUES_BY_SECTION.scripts)
} as const;

export const SW_DESCRIPTION_GENERAL_LITERAL_VALUES = [
	'flash',
	'bootloader',
	'raw',
	'lua',
	'shellscript',
	'preinstall',
	'postinstall',
	...SW_DESCRIPTION_COMPRESSED_VALUES,
	...SW_DESCRIPTION_ENCRYPTED_VALUES,
	...SW_DESCRIPTION_UPDATE_TYPE_VALUES
] as const;

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

/**
 * All spec-defined property keys that may appear at the entry level inside
 * images / files / scripts / partitions list items. Anything outside this set
 * (and not matching partition-\d+) is a candidate typo.
 */
export const SW_DESCRIPTION_ENTRY_KNOWN_KEYS = new Set<string>([
	// Identification / versioning
	'filename', 'name', 'version', 'description',
	// Target location
	'volume', 'ubipartition', 'device', 'mtdname', 'path', 'filesystem', 'fstype',
	// Install behaviour
	'type', 'compressed', 'encrypted', 'installed-directly', 'offset', 'size',
	'install-if-different', 'install-if-higher',
	// Integrity
	'sha256', 'aes-key', 'ivt',
	// Files handler
	'preserve-attributes',
	// Scripting
	'data', 'hook', 'ref', 'embedded-script',
	// Handler-properties sub-block (contents are handler-specific, not checked)
	'properties',
	// bootenv / vars sections
	'value'
]);

export const SW_DESCRIPTION_SHA256_REGEX = /^[0-9a-fA-F]{64}$/;
export const SW_DESCRIPTION_SHA256_FUNCTION_REGEX = /^\$swupdate_get_sha256\([^\)]+\)$/;
export const SW_DESCRIPTION_SIZE_REGEX = /^\d+(K|M|G)?$/;
export const SW_DESCRIPTION_OFFSET_REGEX = SW_DESCRIPTION_SIZE_REGEX;
export const SW_DESCRIPTION_IVT_REGEX = /^[0-9a-fA-F]{32}$/;
export const SW_DESCRIPTION_AES_KEY_REGEX = /^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{48}$|^[0-9a-fA-F]{64}$/;
export const SW_DESCRIPTION_EXTERNAL_VARIABLE_REGEX = /^@@[^@]+@@$/;

export function isSwDescriptionDocumentUri(uri: string): boolean {
	const normalizedUri = decodeURIComponent(uri).split('?')[0].split('#')[0];
	const separatorIndex = Math.max(normalizedUri.lastIndexOf('/'), normalizedUri.lastIndexOf('\\'));
	const fileName = (separatorIndex === -1 ? normalizedUri : normalizedUri.slice(separatorIndex + 1)).toLowerCase();
	return fileName.startsWith('sw-description');
}