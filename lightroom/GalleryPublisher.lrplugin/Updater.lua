--[[
	Checks the site for a newer version of this plugin and installs it over the copy Lightroom is
	running. The site reports the current build in /api/lightroom; Defaults.lua holds ours. The new
	files take effect once Lightroom is restarted (or the plugin is reloaded in the Plug-in Manager).
	Calls that touch the network must run inside an LrTasks task.
]]

local LrDialogs = import 'LrDialogs'
local LrFileUtils = import 'LrFileUtils'
local LrPathUtils = import 'LrPathUtils'
local LrTasks = import 'LrTasks'

local API = require 'GalleryAPI'
local Defaults = require 'Defaults'

local Updater = {}

local function fail(message)
	error(message, 0)
end

-- Set once an update has been installed, so we don't offer it again before a restart.
local installed = false
-- Asked about after a publish at most once per Lightroom session.
local offered = false

--- The site's build if it differs from ours, otherwise nil. `ping` is a reply from API.ping.
function Updater.newerBuild(ping)
	if installed or type(ping) ~= 'table' or type(ping.plugin) ~= 'string' then return nil end
	if ping.plugin == '' or ping.plugin == Defaults.build then return nil end
	return ping.plugin
end

--- Asks the site. Returns its build when there's an update, otherwise nil.
function Updater.check(settings)
	return Updater.newerBuild(API.ping(settings))
end

local function quotePosix(path)
	return "'" .. path:gsub("'", "'\\''") .. "'"
end

local function unzip(zipPath, destination)
	local command
	if WIN_ENV then
		-- Lightroom runs this through cmd, which needs the whole line wrapped in quotes once more.
		command = '"powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "'
			.. "Expand-Archive -Force -LiteralPath '" .. zipPath:gsub("'", "''")
			.. "' -DestinationPath '" .. destination:gsub("'", "''") .. "'" .. '""'
	else
		command = '/usr/bin/ditto -x -k ' .. quotePosix(zipPath) .. ' ' .. quotePosix(destination)
	end
	if LrTasks.execute(command) ~= 0 then fail('Couldn’t unpack the update.') end
end

--- Downloads the current plugin from the site and copies its files over this one.
function Updater.install(settings)
	local temp = LrFileUtils.chooseUniqueFileName(
		LrPathUtils.child(LrPathUtils.getStandardFilePath('temp'), 'GalleryPublisherUpdate'))
	LrFileUtils.createAllDirectories(temp)

	local ok, result = LrTasks.pcall(function()
		local body, headers = API.download(settings, '/api/lightroom/plugin')
		local zipPath = LrPathUtils.child(temp, 'plugin.zip')
		local file = assert(io.open(zipPath, 'wb'))
		file:write(body)
		file:close()

		local unpacked = LrPathUtils.child(temp, 'files')
		LrFileUtils.createAllDirectories(unpacked)
		unzip(zipPath, unpacked)

		-- Check the download looks right before touching the installed copy.
		local source = LrPathUtils.child(unpacked, 'GalleryPublisher.lrplugin')
		if not LrFileUtils.exists(LrPathUtils.child(source, 'Info.lua')) then
			fail('The update was incomplete. Nothing was changed.')
		end

		for path in LrFileUtils.files(source) do
			local name = LrPathUtils.leafName(path)
			if name:match('%.lua$') then
				local target = LrPathUtils.child(_PLUGIN.path, name)
				if LrFileUtils.exists(target) then LrFileUtils.delete(target) end
				local copied, message = LrFileUtils.copy(path, target)
				if not copied then
					fail('Couldn’t replace ' .. name .. ' (' .. tostring(message) .. '). Download the plugin '
						.. 'again from the site’s admin, under Lightroom.')
				end
			end
		end
	end)
	LrFileUtils.delete(temp)
	if not ok then error(result, 0) end
	installed = true
end

local RESTART = 'Restart Lightroom to start using it. (Or choose File → Plug-in Manager, select '
	.. 'Gallery Publisher and click Reload Plug-in.)'

--- Installs, then says what happened. Runs inside a task.
function Updater.installAndReport(settings)
	local ok, message = LrTasks.pcall(Updater.install, settings)
	if ok then
		LrDialogs.message('Gallery Publisher was updated', RESTART, 'info')
	else
		LrDialogs.message('Gallery Publisher couldn’t update', tostring(message), 'critical')
	end
	return ok
end

--- After a publish: if there's an update, asks once per session whether to install it.
function Updater.offerAfterPublish(settings)
	if offered or installed then return end
	offered = true
	local ok, build = LrTasks.pcall(Updater.check, settings)
	if not ok or not build then return end
	local choice = LrDialogs.confirm(
		'An update to Gallery Publisher is available',
		'The site has a newer version of this plugin. Install it now? It takes effect when you '
			.. 'restart Lightroom.',
		'Install Update',
		'Not Now')
	if choice == 'ok' then Updater.installAndReport(settings) end
end

return Updater
