--[[
	Gallery Publisher: publishes collections from Lightroom Classic to the self-hosted gallery.
	Install with File → Plug-in Manager → Add, then set it up under Publish Services.
]]

return {
	LrSdkVersion = 10.0,
	LrSdkMinimumVersion = 6.0,
	LrToolkitIdentifier = 'gallery.publisher',
	LrPluginName = 'Gallery Publisher',

	LrExportServiceProvider = {
		title = 'Gallery',
		file = 'GalleryServiceProvider.lua',
	},

	VERSION = { major = 1, minor = 0, revision = 0, build = 0 },
}
