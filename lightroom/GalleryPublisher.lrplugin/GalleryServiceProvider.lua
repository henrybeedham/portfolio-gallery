--[[
	A Lightroom Classic publish service for the gallery. Each published collection is an album on
	the site: a new one named after the collection (optionally linked to a job), or an existing one.

	- Publishing uploads the photos. Republishing an edited photo replaces it in place, so its link,
	  tags and download count stay.
	- Removing photos from the collection deletes them from the album.
	- Renaming the collection renames the album (its web address stays the same).
	- Deleting the collection leaves the album on the site; delete it there if you mean to.
	- When the site has a newer version of this plugin, the settings dialog says so and can install
	  it, and you're asked once per session after a publish (Updater.lua).
]]

local LrView = import 'LrView'
local LrTasks = import 'LrTasks'
local LrFileUtils = import 'LrFileUtils'
local LrPathUtils = import 'LrPathUtils'

local API = require 'GalleryAPI'
local Defaults = require 'Defaults'
local Updater = require 'Updater'

local bind = LrView.bind
local share = LrView.share

local provider = {}

-- The service ---------------------------------------------------------------

provider.supportsIncrementalPublish = 'only'
provider.exportPresetFields = {
	{ key = 'serverUrl', default = Defaults.serverUrl or '' },
	{ key = 'token', default = '' },
}

-- The site decides where files live, and makes its own thumbnails from a full-size JPEG.
provider.hideSections = { 'exportLocation' }
provider.allowFileFormats = { 'JPEG' }
provider.allowColorSpaces = { 'sRGB' }
provider.canExportVideo = true

provider.titleForPublishedCollection = 'Album'
provider.titleForPublishedCollection_standalone = 'Album'
provider.titleForGoToPublishedCollection = 'Open Album in Admin'
provider.titleForGoToPublishedPhoto = 'Open Photo on the Site'

function provider.getCollectionBehaviorInfo()
	return {
		defaultCollectionName = 'Untitled Album',
		defaultCollectionCanBeDeleted = true,
		canAddCollection = true,
		maxCollectionSetDepth = 0,
	}
end

--- Edits always republish. These metadata changes do too, since the site reads them from the file.
function provider.metadataThatTriggersRepublish()
	return {
		default = false,
		title = true,
		caption = true,
		keywords = true,
		dateCreated = true,
		gps = true,
	}
end

function provider.sectionsForTopOfDialog(f, propertyTable)
	propertyTable.connectionStatus = ''
	propertyTable.updateStatus = ''
	propertyTable.updateAvailable = false
	local siteName = Defaults.siteTitle and Defaults.siteTitle ~= '' and Defaults.siteTitle or 'Gallery'

	local function showUpdate(ping)
		if Updater.newerBuild(ping) then
			propertyTable.updateAvailable = true
			propertyTable.updateStatus = 'A newer version of this plugin is available.'
		else
			propertyTable.updateAvailable = false
			propertyTable.updateStatus = 'This plugin is up to date.'
		end
	end

	--- `quiet` is for the check when the dialog opens: errors only show after a click.
	local function test(quiet)
		LrTasks.startAsyncTask(function()
			if not quiet then propertyTable.connectionStatus = 'Checking…' end
			local ok, result = LrTasks.pcall(API.ping, propertyTable)
			if ok then
				propertyTable.connectionStatus = 'Connected to ' .. tostring(result.site or 'the site') .. '.'
				showUpdate(result)
			elseif not quiet then
				propertyTable.connectionStatus = tostring(result)
			end
		end)
	end

	local function installUpdate()
		LrTasks.startAsyncTask(function()
			propertyTable.updateStatus = 'Installing…'
			propertyTable.updateAvailable = false
			if Updater.installAndReport(propertyTable) then
				propertyTable.updateStatus = 'Updated. Restart Lightroom to use the new version.'
			else
				propertyTable.updateStatus = 'The update didn’t install.'
				propertyTable.updateAvailable = true
			end
		end)
	end

	-- Look for an update straight away when the service is already set up.
	if (propertyTable.serverUrl or '') ~= '' and (propertyTable.token or '') ~= '' then test(true) end

	return {
		{
			title = siteName,
			synopsis = bind 'serverUrl',

			f:row {
				f:static_text { title = 'Site address:', alignment = 'right', width = share 'labelWidth' },
				f:edit_field {
					value = bind 'serverUrl',
					width_in_chars = 36,
					immediate = true,
				},
			},
			f:row {
				f:static_text { title = 'API token:', alignment = 'right', width = share 'labelWidth' },
				f:password_field {
					value = bind 'token',
					width_in_chars = 36,
					immediate = true,
				},
			},
			f:row {
				f:static_text { title = '', width = share 'labelWidth' },
				f:static_text {
					title = 'Make a token in the gallery’s admin, under Lightroom.',
					size = 'small',
				},
			},
			f:row {
				f:static_text { title = '', width = share 'labelWidth' },
				f:push_button { title = 'Test Connection', action = function() test(false) end },
				f:static_text { title = bind 'connectionStatus', fill_horizontal = 1, width_in_chars = 30 },
			},
			f:row {
				f:static_text { title = '', width = share 'labelWidth' },
				f:push_button {
					title = 'Install Update',
					action = installUpdate,
					enabled = bind 'updateAvailable',
				},
				f:static_text { title = bind 'updateStatus', fill_horizontal = 1, width_in_chars = 30 },
			},
		},
	}
end

-- Collections (albums) ------------------------------------------------------

--- Fills the album and job menus once the site has answered.
local function loadChoices(publishSettings, context)
	LrTasks.startAsyncTask(function()
		local ok, albums = LrTasks.pcall(API.listAlbums, publishSettings)
		if not ok then
			context.loadError = tostring(albums)
			return
		end
		local albumItems = { { title = 'A new album, named after this collection', value = 0 } }
		for _, album in ipairs(albums) do
			albumItems[#albumItems + 1] = {
				title = album.title .. '  (/' .. album.slug .. ', ' .. tostring(album.count) .. ' items)',
				value = album.id,
			}
		end
		context.albumItems = albumItems

		local jobsOk, jobs = LrTasks.pcall(API.listJobs, publishSettings)
		local jobItems = { { title = 'No job', value = 0 } }
		if jobsOk then
			for _, job in ipairs(jobs) do
				local label = job.title
				if job.date and job.date ~= '' then label = label .. ' — ' .. job.date end
				if job.hasAlbum then label = label .. ' (has an album)' end
				jobItems[#jobItems + 1] = { title = label, value = job.id }
			end
		end
		context.jobItems = jobItems
	end)
end

function provider.viewForCollectionSettings(f, publishSettings, info)
	local settings = info.collectionSettings
	local context = info.pluginContext
	local collection = info.publishedCollection
	local remoteId = collection and collection:getRemoteId()

	if remoteId then
		context.linked = 'Checking…'
		LrTasks.startAsyncTask(function()
			local ok, album = LrTasks.pcall(API.findAlbum, publishSettings, remoteId)
			if not ok then
				context.linked = tostring(album)
			elseif album then
				context.linked = album.title .. ' — ' .. album.url
			else
				context.linked = 'The album was deleted on the site. Publishing makes a new one.'
			end
		end)
		return f:group_box {
			title = 'Album',
			fill_horizontal = 1,
			f:static_text { title = bind { key = 'linked', object = context }, width_in_chars = 50 },
			f:static_text {
				title = 'To publish to a different album, make a new collection.',
				size = 'small',
			},
		}
	end

	if settings.albumId == nil then settings.albumId = 0 end
	if settings.jobId == nil then settings.jobId = 0 end
	if settings.visibility == nil then settings.visibility = 'default' end
	context.albumItems = { { title = 'Loading albums…', value = settings.albumId } }
	context.jobItems = { { title = 'Loading jobs…', value = settings.jobId } }
	context.loadError = ''
	loadChoices(publishSettings, context)

	local isNew = bind {
		key = 'albumId',
		transform = function(value) return value == 0 end,
	}

	return f:group_box {
		title = 'Album',
		fill_horizontal = 1,
		bind_to_object = settings,

		f:row {
			f:static_text { title = 'Publish to:', alignment = 'right', width = share 'collectionLabel' },
			f:popup_menu {
				items = bind { key = 'albumItems', object = context },
				value = bind 'albumId',
				width_in_chars = 44,
			},
		},
		f:row {
			f:static_text { title = 'Job:', alignment = 'right', width = share 'collectionLabel' },
			f:popup_menu {
				items = bind { key = 'jobItems', object = context },
				value = bind 'jobId',
				enabled = isNew,
				width_in_chars = 44,
			},
		},
		f:row {
			f:static_text { title = 'Visibility:', alignment = 'right', width = share 'collectionLabel' },
			f:popup_menu {
				items = {
					{ title = 'As in the site’s settings', value = 'default' },
					{ title = 'Public', value = 'public' },
					{ title = 'Private', value = 'private' },
				},
				value = bind 'visibility',
				enabled = isNew,
			},
		},
		f:row {
			f:static_text { title = '', width = share 'collectionLabel' },
			f:static_text {
				title = 'The album is made when you first publish. Linking a job marks it delivered once\nthe album is public and has photos in it.',
				size = 'small',
			},
		},
		f:row {
			f:static_text { title = '', width = share 'collectionLabel' },
			f:static_text { title = bind { key = 'loadError', object = context }, size = 'small' },
		},
	}
end

function provider.renamePublishedCollection(publishSettings, info)
	if info.remoteId then API.renameAlbum(publishSettings, info.remoteId, info.name) end
end

function provider.deletePhotosFromPublishedCollection(publishSettings, arrayOfPhotoIds, deletedCallback)
	local deleted = API.deletePhotos(publishSettings, arrayOfPhotoIds)
	for _, id in ipairs(deleted) do deletedCallback(tostring(id)) end
end

-- Publishing ----------------------------------------------------------------

--- The album this collection publishes to, making it (or making it again) if need be.
local function albumFor(publishSettings, exportContext)
	local info = exportContext.publishedCollectionInfo
	local exportSession = exportContext.exportSession

	if info.remoteId then
		local album = API.findAlbum(publishSettings, info.remoteId)
		if album then return album end
	end

	local settings = exportContext.publishedCollection:getCollectionInfoSummary().collectionSettings or {}
	local album
	if not info.remoteId and settings.albumId and settings.albumId ~= 0 then
		album = API.findAlbum(publishSettings, settings.albumId)
		if not album then error('The album chosen for this collection no longer exists on the site.', 0) end
	else
		local isPublic = nil
		if settings.visibility == 'public' then isPublic = true end
		if settings.visibility == 'private' then isPublic = false end
		album = API.createAlbum(publishSettings, {
			title = info.name,
			jobId = settings.jobId,
			isPublic = isPublic,
		})
	end
	exportSession:recordRemoteCollectionId(tostring(album.id))
	exportSession:recordRemoteCollectionUrl(album.adminUrl)
	return album
end

function provider.processRenderedPhotos(functionContext, exportContext)
	local exportSession = exportContext.exportSession
	local publishSettings = exportContext.propertyTable
	local total = exportSession:countRenditions()

	local progress = exportContext:configureProgress {
		title = total == 1 and 'Publishing 1 photo to the gallery'
			or ('Publishing ' .. total .. ' photos to the gallery'),
	}

	local album = albumFor(publishSettings, exportContext)
	for i, rendition in exportContext:renditions { stopIfCanceled = true } do
		progress:setPortionComplete((i - 1) / total)
		local success, pathOrMessage = rendition:waitForRender()
		if progress:isCanceled() then break end

		if success then
			local ok, photo = LrTasks.pcall(API.uploadFile, publishSettings, album.id, pathOrMessage,
				LrPathUtils.leafName(pathOrMessage), rendition.publishedPhotoId)
			if ok then
				rendition:recordPublishedPhotoId(tostring(photo.id))
				rendition:recordPublishedPhotoUrl(photo.url)
			else
				rendition:uploadFailed(tostring(photo))
			end
			LrFileUtils.delete(pathOrMessage)
		else
			rendition:uploadFailed(pathOrMessage)
		end
	end

	progress:done()
	Updater.offerAfterPublish(publishSettings)
end

return provider
